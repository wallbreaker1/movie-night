export interface Movie {
  id: string;
  title: string;
  /** URL public (Cloudflare R2 / custom domain) către fișierul video. */
  url: string;
  poster?: string;
  /** URL public către fișierul de subtitrare (format WebVTT, .vtt). */
  subtitleUrl?: string;
}

/**
 * Lista de filme disponibile este configurată prin variabila de mediu MOVIES_JSON,
 * un array JSON cu obiecte { id, title, url, poster? }.
 *
 * Exemplu:
 * MOVIES_JSON=[{"id":"film1","title":"Filmul Nostru","url":"https://pub-xxxx.r2.dev/film1.mp4"}]
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
    console.error("MOVIES_JSON este JSON invalid:", err);
    return [];
  }
}
