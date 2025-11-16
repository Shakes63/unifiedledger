import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { backupSettings, backupHistory } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { deleteBackupFile } from '@/lib/backups/backup-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/backups/cleanup
 * Manually trigger cleanup of old backups based on retention count
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    // Get backup settings
    const settings = await db
      .select()
      .from(backupSettings)
      .where(eq(backupSettings.userId, userId))
      .limit(1);

    if (!settings[0]) {
      return NextResponse.json({ error: 'Backup settings not found' }, { status: 404 });
    }

    const retentionCount = settings[0].retentionCount || 10;

    // Fetch all completed backups, ordered by creation date (newest first)
    const allBackups = await db
      .select()
      .from(backupHistory)
      .where(and(eq(backupHistory.userId, userId), eq(backupHistory.status, 'completed')))
      .orderBy(desc(backupHistory.createdAt));

    // Keep the most recent N backups, delete the rest
    const backupsToDelete = allBackups.slice(retentionCount);
    let deletedCount = 0;

    for (const backup of backupsToDelete) {
      try {
        // Delete file from disk
        await deleteBackupFile(userId, backup.filename);

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
    console.error('Failed to cleanup backups:', error);
    return NextResponse.json({ error: 'Failed to cleanup backups' }, { status: 500 });
  }
}

