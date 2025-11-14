import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { session } from '@/auth-schema';
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authResult?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await params;

    // Prevent revoking current session
    if (authResult.session.id === sessionId) {
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
          eq(session.userId, authResult.user.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking session:', error);
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}
