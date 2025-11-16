import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { backupHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createUserBackup } from '@/lib/backups/create-backup';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/backups/create
 * Manually create a backup for a household (for testing/admin use)
 * Requires householdId in request body
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    // Use shared backup creation function
    const result = await createUserBackup(userId, householdId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create backup' },
        { status: 500 }
      );
    }

    // Fetch updated backup record
    const updatedBackup = await db
      .select()
      .from(backupHistory)
      .where(eq(backupHistory.id, result.backupId!))
      .limit(1);

    return NextResponse.json({
      success: true,
      backup: updatedBackup[0],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create backup:', error);
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
  }
}

