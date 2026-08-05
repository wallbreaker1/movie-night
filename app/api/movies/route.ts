import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getMovies } from "@/lib/movies";

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session?.isHost) {
    return NextResponse.json(
      { error: "Only the host can delete movies" },
      { status: 403 },
    );
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return NextResponse.json(
      { error: "R2 is not fully configured" },
      { status: 500 },
    );
  }

  try {
    const body: unknown = await request.json();
    const movieId =
      body && typeof body === "object"
        ? (body as Record<string, unknown>).movieId
        : null;
    if (typeof movieId !== "string") {
      return NextResponse.json({ error: "Missing movieId" }, { status: 400 });
    }

    const movies = await getMovies({ forceRefresh: true });
    const movie = movies.find((candidate) => candidate.id === movieId);
    if (!movie?.key) {
      return NextResponse.json(
        { error: "Movie does not exist in R2" },
        { status: 404 },
      );
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: [movie.key, movie.subtitleKey]
            .filter((key): key is string => Boolean(key))
            .map((Key) => ({ Key })),
        },
      }),
    );

    const updatedMovies = await getMovies({ forceRefresh: true });
    return NextResponse.json({ movies: updatedMovies });
  } catch (error) {
    console.error("Failed to delete R2 movie:", error);
    return NextResponse.json(
      { error: "Could not delete movie" },
      { status: 500 },
    );
  }
}
