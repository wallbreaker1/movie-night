import { NextRequest, NextResponse } from "next/server";
import { getMovies } from "@/lib/movies";

/**
 * Same-origin proxy for subtitle (WebVTT) files.
 *
 * The <track> element in VideoPlayer.tsx points here instead of directly at
 * the Cloudflare R2 URL. This avoids needing a `crossOrigin` attribute on the
 * <video> element (which would also apply to the main video source and can
 * break Range-request playback on strict clients like iOS Safari). Since this
 * route is same-origin, the browser can load the track without any CORS
 * headers on the R2 bucket at all.
 *
 * This route is protected by proxy.ts like the rest of the app (only
 * /login and /api/login are excluded from the auth check).
 */
export async function GET(req: NextRequest) {
  const movieId = req.nextUrl.searchParams.get("movieId");
  if (!movieId) {
    return NextResponse.json({ error: "Missing movieId" }, { status: 400 });
  }

  const movie = getMovies().find((m) => m.id === movieId);
  if (!movie?.subtitleUrl) {
    return NextResponse.json({ error: "Subtitle not found" }, { status: 404 });
  }

  const upstream = await fetch(movie.subtitleUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Failed to fetch subtitle" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
