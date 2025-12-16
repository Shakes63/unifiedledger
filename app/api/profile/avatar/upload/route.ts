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

    // Get form data
    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

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
