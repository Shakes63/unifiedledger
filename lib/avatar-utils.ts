// Server-only avatar utilities (uses Node.js modules like sharp, fs)
import sharp from 'sharp';

// Avatar sizes in pixels
export const AVATAR_SIZE = 400; // Main avatar size
export const AVATAR_QUALITY = 90; // JPEG quality

/**
 * Optimize an image for avatar use
 * Resizes to 400x400 and compresses with high quality
 * Returns a Buffer that can be saved to disk
 * NOTE: This function is only used server-side in API routes
 */
export async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .resize(AVATAR_SIZE, AVATAR_SIZE, {
      fit: 'cover',
      position: 'center',
    })
    .jpeg({
      quality: AVATAR_QUALITY,
      mozjpeg: true, // Use mozjpeg for better compression
    })
    .toBuffer();
}

/**
 * Get the file extension from a File object
 */
export function getFileExtension(file: File): string {
  const parts = file.name.split('.');
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toLowerCase();
    // Normalize jpeg to jpg
    if (ext === 'jpeg') {
      return 'jpg';
    }
    return ext;
  }

  // Fallback: determine from MIME type
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  return mimeMap[file.type] || 'jpg';
}

/**
 * Convert a File to a Buffer for processing
 */
export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
