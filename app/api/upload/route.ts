import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const MAX_SINGLE_UPLOAD_SIZE = 5 * 1024 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".webm",
  ".m4v",
  ".vtt",
  ".srt",
];

function publicObjectUrl(baseUrl: string, key: string): string {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/$/, "")}/${encodedKey}`;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return NextResponse.json(
      { error: "R2 is not fully configured" },
      { status: 500 },
    );
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { fileName, contentType, size } = body as Record<string, unknown>;
    if (
      typeof fileName !== "string" ||
      typeof contentType !== "string" ||
      typeof size !== "number" ||
      !Number.isSafeInteger(size) ||
      size <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid file metadata" },
        { status: 400 },
      );
    }

    const key = fileName.split(/[\\/]/).pop()?.trim();
    const extension = key?.slice(key.lastIndexOf(".")).toLowerCase();
    if (!key || key.length > 255 || !extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { error: "Only video and subtitle files are allowed" },
        { status: 400 },
      );
    }

    if (size > MAX_SINGLE_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: "Files larger than 5 GB require multipart upload" },
        { status: 400 },
      );
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

    return NextResponse.json({
      uploadUrl,
      publicUrl: publicObjectUrl(publicUrl, key),
      fileName: key,
    });
  } catch (error) {
    console.error("Failed to create R2 upload URL:", error);
    return NextResponse.json(
      { error: "Could not prepare upload" },
      { status: 500 },
    );
  }
}
