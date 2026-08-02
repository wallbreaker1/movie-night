import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { password, name } = body;
  const password1 = process.env.APP_PASSWORD_1;
  const password2 = process.env.APP_PASSWORD_2;
  const validPasswords = [password1, password2].filter(
    (p): p is string => Boolean(p && p.length > 0)
  );

  if (validPasswords.length === 0) {
    return NextResponse.json(
      { error: "No password configured on the server (APP_PASSWORD_1 / APP_PASSWORD_2)." },
      { status: 500 }
    );
  }

  if (!password || !validPasswords.includes(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  // APP_PASSWORD_1 is the "host" (master) password: only that account can
  // control playback (play/pause/seek/change movie). APP_PASSWORD_2 is a
  // read-only guest that just watches in sync.
  const isHost = Boolean(password1 && password === password1);

  const displayName = (name ?? "").toString().trim().slice(0, 24) || "Viewer";
  const token = await createSessionToken(displayName, isHost);

  const res = NextResponse.json({ ok: true, name: displayName, isHost });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
