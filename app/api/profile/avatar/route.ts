import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profile/avatar
 * Get current user's avatar URL (data URL)
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

    const [currentUser] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({ avatarUrl: currentUser.image });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Avatar fetch error:', error);
    return Response.json({ error: 'Failed to fetch avatar' }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/avatar
 * Remove user's avatar
 */
export async function DELETE() {
  try {
    const { userId } = await requireAuth();

    await db
      .update(user)
      .set({
        image: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Avatar delete error:', error);
    return Response.json({ error: 'Failed to delete avatar' }, { status: 500 });
  }
}
