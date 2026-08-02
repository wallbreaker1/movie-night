import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
export const SESSION_COOKIE = "movie_session";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET nu este setat. Adaugă-l în .env.local (vezi .env.example)."
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  name: string;
  [key: string]: unknown;
}

/** Creează un token de sesiune semnat, valabil 30 de zile. */
export async function createSessionToken(name: string): Promise<string> {
  return new SignJWT({ name })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

/** Verifică și decodează un token de sesiune. Întoarce null dacă e invalid/expirat. */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.name !== "string") return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
