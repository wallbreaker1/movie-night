import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getMovies } from "@/lib/movies";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const movies = await getMovies({ forceRefresh: true });
    return NextResponse.json(
      { movies, syncedAt: Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error syncing movies:", error);
    return NextResponse.json({ error: "Failed to sync movies" }, { status: 500 });
  }
}
