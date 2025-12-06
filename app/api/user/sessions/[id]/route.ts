import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { isTestMode } from '@/lib/test-mode';
import { db } from '@/lib/db';
import { session } from '@/auth-schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth();
    const userId = authUser.userId;
    const { id: sessionId } = await params;

    // In test mode, just return success
    if (isTestMode()) {
      return NextResponse.json({ success: true });
    }

    // Prevent revoking current session
    const currentSessionId = authUser.session?.id;
    if (currentSessionId === sessionId) {
      return NextResponse.json(
        { error: 'Cannot revoke current session' },
        { status: 400 }
      );
    }

    // Delete session (only if it belongs to current user)
    await db
      .delete(session)
      .where(
        and(
          eq(session.id, sessionId),
          eq(session.userId, userId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error revoking session:', error);
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}
