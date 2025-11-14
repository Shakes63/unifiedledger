import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user as userTable } from '@/auth-schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/cancel-email-change
 * Cancel pending email change
 */
export async function POST() {
  try {
    const { userId } = await requireAuth();

    // Clear pending email
    await db
      .update(userTable)
      .set({
        pendingEmail: null,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, userId));

    return NextResponse.json({
      success: true,
      message: 'Email change canceled successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to cancel email change:', error);
    return NextResponse.json({ error: 'Failed to cancel email change' }, { status: 500 });
  }
}
