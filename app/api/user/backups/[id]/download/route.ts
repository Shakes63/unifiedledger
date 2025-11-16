import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { backupHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { readBackupFile } from '@/lib/backups/backup-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/backups/[id]/download
 * Download a specific backup file
 */
export async function GET(
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

    // Verify backup is completed
    if (backupRecord.status !== 'completed') {
      return NextResponse.json(
        { error: 'Backup is not ready for download' },
        { status: 400 }
      );
    }

    // Read backup file
    try {
      const fileContent = await readBackupFile(userId, backupRecord.filename);
      const contentType =
        backupRecord.format === 'json' ? 'application/json' : 'text/csv';

      return new NextResponse(fileContent, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${backupRecord.filename}"`,
          'Content-Length': backupRecord.fileSize.toString(),
        },
      });
    } catch (error) {
      console.error('Failed to read backup file:', error);
      return NextResponse.json(
        { error: 'Backup file not found on disk' },
        { status: 404 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to download backup:', error);
    return NextResponse.json({ error: 'Failed to download backup' }, { status: 500 });
  }
}

