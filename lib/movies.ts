export interface Movie {
  id: string;
  title: string;
  /** Public URL (Cloudflare R2 / custom domain) to the video file. */
  url: string;
  poster?: string;
  /** Public URL to the subtitle file (WebVTT format, .vtt). */
  subtitleUrl?: string;
}

/**
 * The list of available movies is configured via the MOVIES_JSON environment
 * variable, a JSON array of objects { id, title, url, poster? }.
 *
 * Example:
 * MOVIES_JSON=[{"id":"movie1","title":"Our Movie","url":"https://pub-xxxx.r2.dev/movie1.mp4"}]
 */
export function getMovies(): Movie[] {
  const raw = process.env.MOVIES_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Movie =>
        m &&
        typeof m.id === "string" &&
        typeof m.title === "string" &&
        typeof m.url === "string" &&
        (m.subtitleUrl === undefined || typeof m.subtitleUrl === "string")
    );
  } catch (err) {
    console.error("MOVIES_JSON is invalid JSON:", err);
    return [];
  }
}
