import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

export interface Movie {
  id: string;
  title: string;
  /** Original R2 object key, used for authenticated management actions. */
  key?: string;
  /** Public URL (Cloudflare R2 / custom domain) to the video file. */
  url: string;
  poster?: string;
  /** Public URL to the subtitle file (WebVTT format, .vtt). */
  subtitleUrl?: string;
  /** Original R2 subtitle object key, when one exists. */
  subtitleKey?: string;
}

const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v"];
const SUBTITLE_EXTENSIONS = [".vtt", ".srt"];
const CACHE_DURATION = 60_000;

let moviesCache: Movie[] | null = null;
let lastFetch = 0;

function publicObjectUrl(baseUrl: string, key: string): string {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/$/, "")}/${encodedKey}`;
}

function movieId(key: string): string {
  return key
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function movieTitle(key: string): string {
  const fileName = key.split("/").pop() ?? key;
  return fileName.replace(/\.[^/.]+$/, "").replace(/[._-]+/g, " ").trim();
}

function moviesFromKeys(keys: string[], publicUrl: string): Movie[] {
  const subtitles = keys.filter((key) =>
    SUBTITLE_EXTENSIONS.some((extension) => key.toLowerCase().endsWith(extension)),
  );

  return keys
    .filter((key) => VIDEO_EXTENSIONS.some((extension) => key.toLowerCase().endsWith(extension)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((key) => {
      const baseName = key.replace(/\.[^/.]+$/, "").toLowerCase();
      const subtitle = subtitles.find(
        (candidate) => candidate.replace(/\.[^/.]+$/, "").toLowerCase() === baseName,
      );

      return {
        id: movieId(key),
        title: movieTitle(key),
        key,
        url: publicObjectUrl(publicUrl, key),
        ...(subtitle
          ? {
              subtitleUrl: publicObjectUrl(publicUrl, subtitle),
              subtitleKey: subtitle,
            }
          : {}),
      };
    });
}

async function listR2Movies(): Promise<Movie[] | null> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }),
    );
    for (const object of page.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return moviesFromKeys(keys, publicUrl);
}

function fallbackMovies(): Movie[] {
  const raw = process.env.MOVIES_JSON;
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (movie): movie is Movie =>
        Boolean(movie) &&
        typeof movie.id === "string" &&
        typeof movie.title === "string" &&
        typeof movie.url === "string" &&
        (movie.subtitleUrl === undefined || typeof movie.subtitleUrl === "string"),
    );
  } catch (error) {
    console.error("MOVIES_JSON is invalid JSON:", error);
    return [];
  }
}

/** Lists the current R2 catalog, with MOVIES_JSON as a resilient fallback. */
export async function getMovies(options: { forceRefresh?: boolean } = {}): Promise<Movie[]> {
  if (!options.forceRefresh && moviesCache && Date.now() - lastFetch < CACHE_DURATION) {
    return moviesCache;
  }

  try {
    const r2Movies = await listR2Movies();
    if (r2Movies !== null) {
      moviesCache = r2Movies;
      lastFetch = Date.now();
      return r2Movies;
    }
  } catch (error) {
    console.error("Failed to list movies from R2:", error);
    if (moviesCache) return moviesCache;
  }

  moviesCache = fallbackMovies();
  lastFetch = Date.now();
  return moviesCache;
}
