import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { isTestMode } from '@/lib/test-mode';
import { db } from '@/lib/db';
import { session } from '@/auth-schema';
import { eq, and, ne } from 'drizzle-orm';

export async function POST() {
  try {
    const authUser = await requireAuth();
    const userId = authUser.userId;

    // In test mode, just return success
    if (isTestMode()) {
      return NextResponse.json({ success: true });
    }

    const currentSessionId = authUser.session?.id;
    if (!currentSessionId) {
      return NextResponse.json({ success: true });
    }

    // Delete all sessions except current
    await db
      .delete(session)
      .where(
        and(
          eq(session.userId, userId),
          ne(session.id, currentSessionId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error revoking all sessions:', error);
    return NextResponse.json(
      { error: 'Failed to revoke sessions' },
      { status: 500 }
    );
  }
}
