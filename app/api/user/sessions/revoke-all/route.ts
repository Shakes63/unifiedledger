import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { session } from '@/auth-schema';
import { eq, and, ne } from 'drizzle-orm';
import { headers } from 'next/headers';

export async function POST() {
  try {
    const authResult = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authResult?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete all sessions except current
    await db
      .delete(session)
      .where(
        and(
          eq(session.userId, authResult.user.id),
          ne(session.id, authResult.session.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking all sessions:', error);
    return NextResponse.json(
      { error: 'Failed to revoke sessions' },
      { status: 500 }
    );
  }
}
