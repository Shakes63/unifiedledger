import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profile/avatar
 * Get current user's avatar URL (data URL from userSettings)
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

    const [settings] = await db
      .select({ avatarUrl: userSettings.avatarUrl })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return Response.json({ avatarUrl: settings?.avatarUrl || null });
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
      .update(userSettings)
      .set({ avatarUrl: null, updatedAt: new Date().toISOString() })
      .where(eq(userSettings.userId, userId));

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Avatar delete error:', error);
    return Response.json({ error: 'Failed to delete avatar' }, { status: 500 });
  }
}
