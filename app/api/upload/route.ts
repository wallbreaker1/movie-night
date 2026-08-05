import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Save file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempPath = join(tmpdir(), `upload-${Date.now()}-${file.name}`);
    await writeFile(tempPath, buffer);

    try {
      // Upload to R2 using rclone
      const rclonePath = process.env.RCLONE_PATH || "~/bin/rclone";
      const bucketName = process.env.R2_BUCKET_NAME || "movie-night";

      const { stdout, stderr } = await execAsync(
        `${rclonePath} copy "${tempPath}" r2:${bucketName}/ --s3-no-check-bucket`,
      );

      // Clean up temp file
      await unlink(tempPath);

      const publicUrl =
        process.env.R2_PUBLIC_URL ||
        "https://pub-5814eae11e444ef58ccd460277166557.r2.dev";
      const fileUrl = `${publicUrl}/${file.name}`;

      return NextResponse.json({
        success: true,
        url: fileUrl,
        fileName: file.name,
        size: file.size,
      });
    } catch (error) {
      // Clean up temp file on error
      await unlink(tempPath).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed", details: String(error) },
      { status: 500 },
    );
  }
}
