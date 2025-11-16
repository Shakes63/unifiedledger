import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { backupHistory } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/backups
 * Get list of user's backups (paginated)
 *
 * Query params:
 * - limit: number of results (default: 50)
 * - offset: pagination offset (default: 0)
 * - status: filter by status (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const status = url.searchParams.get('status');

    // Build where clause
    const whereConditions = [eq(backupHistory.userId, userId)];
    if (status && ['pending', 'completed', 'failed'].includes(status)) {
      whereConditions.push(eq(backupHistory.status, status as 'pending' | 'completed' | 'failed'));
    }

    // Fetch backups
    const backups = await db
      .select()
      .from(backupHistory)
      .where(and(...whereConditions))
      .orderBy(desc(backupHistory.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: backupHistory.id })
      .from(backupHistory)
      .where(and(...whereConditions));

    const total = totalResult.length;

    return NextResponse.json({
      backups,
      total,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch backups:', error);
    return NextResponse.json({ error: 'Failed to fetch backups' }, { status: 500 });
  }
}

