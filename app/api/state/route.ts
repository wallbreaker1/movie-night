import { NextRequest, NextResponse } from "next/server";
import { getRoomState, setRoomState, RoomState } from "@/lib/state";
import { pusherServer } from "@/lib/pusher-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { ROOM_CHANNEL, STATE_EVENT } from "@/lib/constants";
import { getMovies } from "@/lib/movies";

export async function GET() {
  const state = await getRoomState();
  return NextResponse.json(state);
}

type Action = "play" | "pause" | "seek" | "load" | "heartbeat";

interface SyncRequestBody {
  action: Action;
  position?: number;
  movieId?: string;
  socketId?: string;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const name = session?.name ?? "Viewer";

  let body: SyncRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { action, position, movieId, socketId } = body;

  // Only the host (logged in with APP_PASSWORD_1) can control playback.
  // Guests can watch in sync but every mutating action is rejected here,
  // regardless of what the client UI allows, so this can't be bypassed.
  if (!session?.isHost) {
    return NextResponse.json(
      { error: "Only the host can control playback." },
      { status: 403 }
    );
  }

  const current = await getRoomState();
  const next: RoomState = { ...current, updatedAt: Date.now(), updatedBy: name };

  switch (action) {
    case "play":
      next.isPlaying = true;
      if (typeof position === "number") next.position = position;
      break;
    case "pause":
      next.isPlaying = false;
      if (typeof position === "number") next.position = position;
      break;
    case "seek":
      if (typeof position === "number") next.position = position;
      break;
    case "load":
      if (!movieId) {
        return NextResponse.json({ error: "Missing movieId" }, { status: 400 });
      }
      const movies = await getMovies({ forceRefresh: true });
      if (!movies.some((movie) => movie.id === movieId)) {
        return NextResponse.json({ error: "Movie is not in the R2 playlist" }, { status: 400 });
      }
      next.movieId = movieId;
      next.position = 0;
      next.isPlaying = false;
      break;
    case "heartbeat":
      if (typeof position === "number") next.position = position;
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await setRoomState(next);

  // Heartbeat only updates Redis silently (so new joiners get the correct
  // position via GET /api/state). It must NOT broadcast via Pusher — clients
  // who are already playing don't need to be re-synced every 20 seconds, and
  // doing so causes jump-backs when there's any request latency.
  if (action === "heartbeat") {
    return NextResponse.json(next);
  }

  try {
    await pusherServer.trigger(
      ROOM_CHANNEL,
      STATE_EVENT,
      next,
      socketId ? { socket_id: socketId } : undefined
    );
  } catch (err) {
    console.error("Error sending Pusher event:", err);
  }

  return NextResponse.json(next);
}
