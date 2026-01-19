import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { optimizeImage } from '@/lib/avatar-utils';
import { ensureUploadsSubdir, getAvatarFilename, getAvatarUrlPath, getUploadsDir } from '@/lib/uploads/storage';

export const dynamic = 'force-dynamic';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: Request) {
  try {
    // Auth first
    const { userId } = await requireAuth();

    // Get headers
    const contentType = request.headers.get('content-type');
    const filename = request.headers.get('x-filename');
    
    console.log('[Avatar Upload] Request received:', {
      method: request.method,
      contentType,
      filename: filename ? decodeURIComponent(filename) : null,
    });

    // Validate content type
    if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
      console.error('[Avatar Upload] Invalid content type:', contentType);
      return Response.json(
        { error: `Invalid file type: ${contentType}. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Read body using stream to avoid "body disturbed" errors
    let buffer: Buffer;
    try {
      const chunks: Uint8Array[] = [];
      const reader = request.body?.getReader();
      
      if (!reader) {
        return Response.json(
          { error: 'No request body' },
          { status: 400 }
        );
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      
      buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    } catch (bodyError) {
      console.error('[Avatar Upload] Failed to read body:', bodyError);
      return Response.json(
        { error: 'Failed to read upload data. Please try again.' },
        { status: 400 }
      );
    }
    
    console.log('[Avatar Upload] Body received:', buffer.length, 'bytes');
    console.log('[Avatar Upload] First 8 bytes (hex):', buffer.slice(0, 8).toString('hex'));

    // Validate we got data
    if (buffer.length === 0) {
      return Response.json(
        { error: 'No file data received' },
        { status: 400 }
      );
    }

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      return Response.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Verify the data matches expected image signatures
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJPEG = buffer[0] === 0xff && buffer[1] === 0xd8;
    const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
    const isWEBP = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;

    if (!isPNG && !isJPEG && !isGIF && !isWEBP) {
      console.error('[Avatar Upload] Invalid image signature. First 8 bytes:', buffer.slice(0, 8).toString('hex'));
      return Response.json(
        { error: 'Invalid image data. File does not appear to be a valid image.' },
        { status: 400 }
      );
    }

    console.log('[Avatar Upload] Valid image detected:', isPNG ? 'PNG' : isJPEG ? 'JPEG' : isGIF ? 'GIF' : 'WEBP');

    // Get current user to check for existing avatar
    const currentUser = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (currentUser.length === 0) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete old avatar file if it exists
    if (currentUser[0].image) {
      try {
        const oldFilename = currentUser[0].image.split('/').pop();
        if (oldFilename) {
          const uploadsOldPath = join(getUploadsDir(), 'avatars', oldFilename);
          await unlink(uploadsOldPath).catch(() => undefined);
          const legacyOldPath = join(process.cwd(), 'public', 'uploads', 'avatars', oldFilename);
          await unlink(legacyOldPath).catch(() => undefined);
        }
      } catch {
        // File might not exist, ignore error
      }
    }

    // Optimize the uploaded image
    const optimizedBuffer = await optimizeImage(buffer);

    // Store optimized avatars as JPEG under the persisted uploads directory
    await ensureUploadsSubdir('avatars');
    const avatarFilename = getAvatarFilename(userId);
    const avatarPath = getAvatarUrlPath(avatarFilename);
    const fullPath = join(getUploadsDir(), 'avatars', avatarFilename);

    // Save file to disk
    await writeFile(fullPath, optimizedBuffer);

    // Update database with new avatar URL and timestamp
    await db
      .update(user)
      .set({
        image: avatarPath,
        imageUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    console.log('[Avatar Upload] Success! Saved to:', avatarPath);

    return Response.json({
      success: true,
      avatarUrl: avatarPath,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Avatar upload error:', error);
    return Response.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}
