import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

/**
 * Authorization endpoint for the Pusher presence channel.
 * The proxy already blocks unauthenticated requests, but we check again here
 * for clarity and to extract the user's display name.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const socketId = formData.get("socket_id");
  const channel = formData.get("channel_name");

  if (typeof socketId !== "string" || typeof channel !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const presenceData = {
    user_id: `${session.name}-${Math.random().toString(36).slice(2, 10)}`,
    user_info: { name: session.name },
  };

  const authResponse = pusherServer.authorizeChannel(socketId, channel, presenceData);
  return NextResponse.json(authResponse);
}
