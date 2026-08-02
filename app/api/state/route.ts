import { NextRequest, NextResponse } from "next/server";
import { getRoomState, setRoomState, RoomState } from "@/lib/state";
import { pusherServer } from "@/lib/pusher-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { ROOM_CHANNEL, STATE_EVENT } from "@/lib/constants";

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
  const name = session?.name ?? "Spectator";

  let body: SyncRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }

  const { action, position, movieId, socketId } = body;
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
      if (movieId) next.movieId = movieId;
      next.position = 0;
      next.isPlaying = false;
      break;
    case "heartbeat":
      if (typeof position === "number") next.position = position;
      break;
    default:
      return NextResponse.json({ error: "Acțiune necunoscută" }, { status: 400 });
  }

  await setRoomState(next);

  try {
    await pusherServer.trigger(
      ROOM_CHANNEL,
      STATE_EVENT,
      next,
      socketId ? { socket_id: socketId } : undefined
    );
  } catch (err) {
    console.error("Eroare la trimiterea evenimentului Pusher:", err);
  }

  return NextResponse.json(next);
}
