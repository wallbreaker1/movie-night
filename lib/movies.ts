import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface Movie {
  id: string;
  title: string;
  /** Public URL (Cloudflare R2 / custom domain) to the video file. */
  url: string;
  poster?: string;
  /** Public URL to the subtitle file (WebVTT format, .vtt). */
  subtitleUrl?: string;
}

let moviesCache: Movie[] | null = null;
let lastFetch = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute cache

/**
 * Auto-syncs movies from R2 bucket using rclone.
 * Falls back to MOVIES_JSON env variable if R2 sync fails.
 */
export async function getMovies(): Promise<Movie[]> {
  // Return cached movies if still fresh
  if (moviesCache && Date.now() - lastFetch < CACHE_DURATION) {
    return moviesCache;
  }

  // Try to sync from R2
  try {
    const rclonePath = process.env.RCLONE_PATH || "~/bin/rclone";
    const bucketName = process.env.R2_BUCKET_NAME || "movie-night";
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (publicUrl) {
      const { stdout } = await execAsync(
        `${rclonePath} lsf r2:${bucketName}/ --s3-no-check-bucket`
      );

      const files = stdout.trim().split("\n").filter(Boolean);
      const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v"];

      const movies = files
        .filter((file) =>
          videoExtensions.some((ext) => file.toLowerCase().endsWith(ext))
        )
        .map((file) => {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, "");
          const id = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]+/g, "-");

          const subtitleFile = files.find(
            (f) =>
              (f.endsWith(".vtt") || f.endsWith(".srt")) &&
              f.startsWith(nameWithoutExt)
          );

          return {
            id,
            title: nameWithoutExt.replace(/[._-]/g, " "),
            url: `${publicUrl}/${file}`,
            ...(subtitleFile && {
              subtitleUrl: `${publicUrl}/${subtitleFile}`,
            }),
          };
        });

      if (movies.length > 0) {
        moviesCache = movies;
        lastFetch = Date.now();
        return movies;
      }
    }
  } catch (error) {
    console.error("Failed to sync movies from R2:", error);
  }

  // Fallback to MOVIES_JSON
  const raw = process.env.MOVIES_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const movies = parsed.filter(
      (m): m is Movie =>
        m &&
        typeof m.id === "string" &&
        typeof m.title === "string" &&
        typeof m.url === "string" &&
        (m.subtitleUrl === undefined || typeof m.subtitleUrl === "string")
    );
    moviesCache = movies;
    lastFetch = Date.now();
    return movies;
  } catch (err) {
    console.error("MOVIES_JSON is invalid JSON:", err);
    return [];
  }
}
