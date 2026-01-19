import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { getUploadsDir } from '@/lib/uploads/storage';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profile/avatar
 * Get current user's avatar URL
 */
export async function GET(_request: Request) {
  try {
    const { userId } = await requireAuth();

    const currentUser = await db
      .select({
        image: user.image,
        imageUpdatedAt: user.imageUpdatedAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (currentUser.length === 0) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Add cache-busting timestamp to avatar URL if it exists
    let avatarUrl = currentUser[0].image;
    if (avatarUrl && currentUser[0].imageUpdatedAt) {
      const timestamp = new Date(currentUser[0].imageUpdatedAt).getTime();
      avatarUrl = `${avatarUrl}?v=${timestamp}`;
    }

    return Response.json({
      avatarUrl,
      updatedAt: currentUser[0].imageUpdatedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Avatar fetch error:', error);
    return Response.json(
      { error: 'Failed to fetch avatar' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/avatar
 * Remove user's avatar
 */
export async function DELETE(_request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get current user to find avatar file
    const currentUser = await db
      .select({
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (currentUser.length === 0) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete avatar file if it exists
    if (currentUser[0].image) {
      try {
        const filename = currentUser[0].image.split('/').pop();
        if (filename) {
          const uploadsPath = join(getUploadsDir(), 'avatars', filename);
          await unlink(uploadsPath).catch(() => undefined);
          const legacyPath = join(process.cwd(), 'public', 'uploads', 'avatars', filename);
          await unlink(legacyPath).catch(() => undefined);
        }
      } catch (error) {
        // File might not exist, log but continue
        console.log('Avatar file deletion error:', error);
      }
    }

    // Update database to remove avatar URL
    await db
      .update(user)
      .set({
        image: null,
        imageUpdatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return Response.json({
      success: true,
      message: 'Avatar removed successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Avatar deletion error:', error);
    return Response.json(
      { error: 'Failed to delete avatar' },
      { status: 500 }
    );
  }
}
