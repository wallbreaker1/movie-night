import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
export const SESSION_COOKIE = "movie_session";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Add it to .env.local (see .env.example)."
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  name: string;
  /** Whether this session is the "host" (logged in with APP_PASSWORD_1) and
   * therefore allowed to control playback (play/pause/seek/change movie).
   * Guests (APP_PASSWORD_2) can only watch in sync, read-only. */
  isHost: boolean;
  [key: string]: unknown;
}

/** Creates a signed session token, valid for 30 days. */
export async function createSessionToken(name: string, isHost: boolean): Promise<string> {
  return new SignJWT({ name, isHost })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

/** Verifies and decodes a session token. Returns null if invalid/expired. */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.name !== "string") return null;
    return { ...payload, isHost: Boolean(payload.isHost) } as SessionPayload;
  } catch {
    return null;
  }
}
