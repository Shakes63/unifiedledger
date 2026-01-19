import { ensureUploadsSubdir, getUploadsDir } from "@/lib/uploads/storage";
import { createReadStream, existsSync } from "fs";
import { stat, copyFile } from "fs/promises";
import { join, basename } from "path";
import { NextResponse } from "next/server";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

function contentTypeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

// Avatar images are served without auth because:
// 1. Next.js image optimizer makes server-side requests without cookies
// 2. Avatars are just profile pictures, not sensitive data
// 3. Avatar URLs contain user IDs which are not easily guessable
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  const safeName = basename(filename);
  if (!safeName || safeName !== filename) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const dot = safeName.lastIndexOf(".");
  if (dot <= 0) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  await ensureUploadsSubdir("avatars");

  const uploadsPath = join(getUploadsDir(), "avatars", safeName);
  const legacyPublicPath = join(process.cwd(), "public", "uploads", "avatars", safeName);

  // Prefer persisted uploads dir; fallback to legacy public/uploads, and try to migrate it forward.
  let filePath = uploadsPath;
  if (!existsSync(filePath) && existsSync(legacyPublicPath)) {
    filePath = legacyPublicPath;
    try {
      await copyFile(legacyPublicPath, uploadsPath);
      filePath = uploadsPath;
    } catch {
      // Ignore copy errors; serve from legacy path if possible.
      filePath = legacyPublicPath;
    }
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fileStat = await stat(filePath);
  const stream = createReadStream(filePath);

  return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": contentTypeForFilename(safeName),
      "Content-Length": String(fileStat.size),
      // Avatar images are user-scoped/private; avoid shared caches.
      "Cache-Control": "private, max-age=3600",
    },
  });
}


