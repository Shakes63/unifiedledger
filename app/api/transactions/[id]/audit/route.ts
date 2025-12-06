import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactionAuditLog, transactions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transactions/{id}/audit
 * 
 * Fetches paginated audit history for a specific transaction.
 * Returns all changes made to the transaction including who made them,
 * what fields changed, and when.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this transaction
    const transaction = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);

    // Also check audit log for deleted transactions (they won't be in transactions table)
    const auditExists = await db
      .select({ id: transactionAuditLog.id })
      .from(transactionAuditLog)
      .where(
        and(
          eq(transactionAuditLog.transactionId, id),
          eq(transactionAuditLog.householdId, householdId)
        )
      )
      .limit(1);

    if (transaction.length === 0 && auditExists.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Parse query params
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Fetch audit log entries
    const auditEntries = await db
      .select()
      .from(transactionAuditLog)
      .where(
        and(
          eq(transactionAuditLog.transactionId, id),
          eq(transactionAuditLog.householdId, householdId)
        )
      )
      .orderBy(desc(transactionAuditLog.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: transactionAuditLog.id })
      .from(transactionAuditLog)
      .where(
        and(
          eq(transactionAuditLog.transactionId, id),
          eq(transactionAuditLog.householdId, householdId)
        )
      );

    const total = totalResult.length;

    // Parse JSON fields in entries
    const parsedEntries = auditEntries.map(entry => ({
      ...entry,
      changes: entry.changes ? JSON.parse(entry.changes) : null,
      snapshot: entry.snapshot ? JSON.parse(entry.snapshot) : null,
    }));

    return Response.json({
      data: parsedEntries,
      total,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Transaction audit fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}









