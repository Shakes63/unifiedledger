import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { backupHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { deleteBackupFile } from '@/lib/backups/backup-utils';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/user/backups/[id]
 * Delete a backup file and history record
 * Verifies user has access to the household the backup belongs to
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    // Fetch backup record
    const backup = await db
      .select()
      .from(backupHistory)
      .where(and(eq(backupHistory.id, id), eq(backupHistory.userId, userId)))
      .limit(1);

    if (!backup || backup.length === 0) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    const backupRecord = backup[0];

    // Verify user has access to this household
    try {
      await getAndVerifyHousehold(request, userId, { householdId: backupRecord.householdId });
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized: Not a member of this household' },
        { status: 403 }
      );
    }

    // Delete file from disk (household-specific path)
    try {
      await deleteBackupFile(userId, backupRecord.householdId, backupRecord.filename);
    } catch (error) {
      console.error('Failed to delete backup file:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete record from database
    await db
      .delete(backupHistory)
      .where(and(eq(backupHistory.id, id), eq(backupHistory.userId, userId)));

    return NextResponse.json({
      success: true,
      message: 'Backup deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to delete backup:', error);
    return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 });
  }
}

