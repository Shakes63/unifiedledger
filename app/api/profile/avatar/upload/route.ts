import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { validateImageFile } from '@/lib/avatar-client-utils';
import {
  optimizeImage,
  fileToBuffer,
} from '@/lib/avatar-utils';
import { ensureUploadsSubdir, getAvatarFilename, getAvatarUrlPath, getUploadsDir } from '@/lib/uploads/storage';

export const dynamic = 'force-dynamic';

// Maximum file size: 5MB (used for client-side validation reference)
const _MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Debug: Log request details
    const contentType = request.headers.get('content-type');
    console.log('[Avatar Upload] Request details:', {
      method: request.method,
      contentType,
      bodyUsed: request.bodyUsed,
    });

    // Check if body was already consumed
    if (request.bodyUsed) {
      console.error('[Avatar Upload] Request body already consumed!');
      return Response.json(
        { error: 'Request body already consumed' },
        { status: 400 }
      );
    }

    // Verify content type is multipart/form-data
    if (!contentType?.includes('multipart/form-data')) {
      console.error('[Avatar Upload] Invalid content type:', contentType);
      return Response.json(
        { error: `Invalid content type: ${contentType}. Expected multipart/form-data` },
        { status: 400 }
      );
    }

    // Get form data
    let formData: FormData;
    try {
      formData = await request.formData();
      console.log('[Avatar Upload] FormData parsed successfully');
      console.log('[Avatar Upload] FormData keys:', [...formData.keys()]);
    } catch (formError) {
      console.error('[Avatar Upload] FormData parse error:', formError);
      console.error('[Avatar Upload] Error name:', formError instanceof Error ? formError.name : 'N/A');
      console.error('[Avatar Upload] Error message:', formError instanceof Error ? formError.message : String(formError));
      console.error('[Avatar Upload] Error stack:', formError instanceof Error ? formError.stack : 'N/A');
      return Response.json(
        { error: `Failed to parse form data: ${formError instanceof Error ? formError.message : 'Unknown error'}` },
        { status: 400 }
      );
    }
    
    const file = formData.get('avatar') as File | null;
    console.log('[Avatar Upload] File retrieved:', file ? `${file.name} (${file.size} bytes, ${file.type})` : 'null');

    if (!file) {
      return Response.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400 }
      );
    }

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
      } catch (error) {
        // File might not exist, ignore error
        console.log('No old avatar to delete or deletion failed:', error);
      }
    }

    // Convert file to buffer and optimize
    const buffer = await fileToBuffer(file);
    const optimizedBuffer = await optimizeImage(buffer);

    // We store optimized avatars as JPEG under the persisted uploads directory.
    await ensureUploadsSubdir('avatars');
    const filename = getAvatarFilename(userId);
    const avatarPath = getAvatarUrlPath(filename);
    const fullPath = join(getUploadsDir(), 'avatars', filename);

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
