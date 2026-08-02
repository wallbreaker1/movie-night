import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

/**
 * Endpoint de autorizare pentru canalul de prezență Pusher.
 * Middleware-ul deja blochează cererile neautentificate, dar verificăm din nou aici
 * pentru claritate și pentru a extrage numele afișat al utilizatorului.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  const formData = await req.formData();
  const socketId = formData.get("socket_id");
  const channel = formData.get("channel_name");

  if (typeof socketId !== "string" || typeof channel !== "string") {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }

  const presenceData = {
    user_id: `${session.name}-${Math.random().toString(36).slice(2, 10)}`,
    user_info: { name: session.name },
  };

  const authResponse = pusherServer.authorizeChannel(socketId, channel, presenceData);
  return NextResponse.json(authResponse);
}
