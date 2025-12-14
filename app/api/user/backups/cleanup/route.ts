import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { backupSettings, backupHistory } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { deleteBackupFile, splitByRetentionCount } from '@/lib/backups/backup-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/backups/cleanup
 * Manually trigger cleanup of old backups based on retention count for a household
 * Requires householdId in request body
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    // Get backup settings for this household
    const settings = await db
      .select()
      .from(backupSettings)
      .where(
        and(
          eq(backupSettings.userId, userId),
          eq(backupSettings.householdId, householdId)
        )
      )
      .limit(1);

    if (!settings[0]) {
      return NextResponse.json({ error: 'Backup settings not found for this household' }, { status: 404 });
    }

    const retentionCount = settings[0].retentionCount || 10;

    // Fetch all completed backups for this household, ordered by creation date (newest first)
    const allBackups = await db
      .select()
      .from(backupHistory)
      .where(
        and(
          eq(backupHistory.userId, userId),
          eq(backupHistory.householdId, householdId),
          eq(backupHistory.status, 'completed')
        )
      )
      .orderBy(desc(backupHistory.createdAt));

    // Keep the most recent N backups, delete the rest
    const { remove: backupsToDelete } = splitByRetentionCount(allBackups, retentionCount);
    let deletedCount = 0;

    for (const backup of backupsToDelete) {
      try {
        // Delete file from disk (household-specific path)
        await deleteBackupFile(userId, backup.householdId, backup.filename);

        // Delete record from database
        await db.delete(backupHistory).where(eq(backupHistory.id, backup.id));

        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete backup ${backup.id}:`, error);
        // Continue with other backups even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      message: `Deleted ${deletedCount} old backup(s)`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to cleanup backups:', error);
    return NextResponse.json({ error: 'Failed to cleanup backups' }, { status: 500 });
  }
}

