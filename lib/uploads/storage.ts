import { mkdir } from "fs/promises";
import { join } from "path";

export function getUploadsDir(): string {
  const env = process.env.UPLOADS_DIR?.trim();
  if (env) return env;

  // Unraid CA contract for production containers
  if (process.env.NODE_ENV === "production") return "/config/uploads";

  // Local dev fallback
  return join(process.cwd(), "public", "uploads");
}

export async function ensureUploadsSubdir(subdir: string): Promise<string> {
  const dir = join(getUploadsDir(), subdir);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function getAvatarFilename(userId: string): string {
  // We always store optimized avatars as JPEG.
  return `${userId}.jpg`;
}

export function getAvatarUrlPath(filename: string): string {
  return `/uploads/avatars/${filename}`;
}


