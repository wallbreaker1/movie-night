import { exec } from "child_process";
import { promisify } from "util";
import { NextResponse } from "next/server";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rclonePath = process.env.RCLONE_PATH || "~/bin/rclone";
    const bucketName = process.env.R2_BUCKET_NAME || "movie-night";
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!publicUrl) {
      return NextResponse.json(
        { error: "R2_PUBLIC_URL not configured" },
        { status: 500 }
      );
    }

    // List all files from bucket
    const { stdout } = await execAsync(
      `${rclonePath} lsf r2:${bucketName}/ --s3-no-check-bucket`
    );

    const files = stdout.trim().split("\n").filter(Boolean);

    // Filter only video files
    const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v"];
    const movies = files
      .filter((file) =>
        videoExtensions.some((ext) => file.toLowerCase().endsWith(ext))
      )
      .map((file) => {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, "");
        const id = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        // Look for associated subtitle (.vtt or .srt)
        const subtitleFile = files.find(
          (f) =>
            (f.endsWith(".vtt") || f.endsWith(".srt")) &&
            f.startsWith(nameWithoutExt)
        );

        return {
          id,
          title: nameWithoutExt.replace(/[._-]/g, " "),
          url: `${publicUrl}/${file}`,
          ...(subtitleFile && { subtitleUrl: `${publicUrl}/${subtitleFile}` }),
        };
      });

    return NextResponse.json({ movies });
  } catch (error) {
    console.error("Error syncing movies:", error);
    return NextResponse.json(
      { error: "Failed to sync movies", details: String(error) },
      { status: 500 }
    );
  }
}
