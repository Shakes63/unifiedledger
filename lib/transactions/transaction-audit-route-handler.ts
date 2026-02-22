import { and, desc, eq } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { handleRouteError } from '@/lib/api/route-helpers';
import { db } from '@/lib/db';
import { transactionAuditLog, transactions } from '@/lib/db/schema';

function parseAuditPagination(request: Request): { limit: number; offset: number } {
  const url = new URL(request.url);
  return {
    limit: Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100),
    offset: parseInt(url.searchParams.get('offset') || '0', 10),
  };
}

async function verifyTransactionAuditAccess(
  transactionId: string,
  userId: string,
  householdId: string
): Promise<boolean> {
  const [transaction] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      )
    )
    .limit(1);

  if (transaction) {
    return true;
  }

  const [auditEntry] = await db
    .select({ id: transactionAuditLog.id })
    .from(transactionAuditLog)
    .where(
      and(
        eq(transactionAuditLog.transactionId, transactionId),
        eq(transactionAuditLog.householdId, householdId)
      )
    )
    .limit(1);

  return Boolean(auditEntry);
}

export async function handleGetTransactionAudit(
  request: Request,
  transactionId: string
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const hasAccess = await verifyTransactionAuditAccess(transactionId, userId, householdId);
    if (!hasAccess) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const { limit, offset } = parseAuditPagination(request);

    const auditEntries = await db
      .select()
      .from(transactionAuditLog)
      .where(
        and(
          eq(transactionAuditLog.transactionId, transactionId),
          eq(transactionAuditLog.householdId, householdId)
        )
      )
      .orderBy(desc(transactionAuditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ id: transactionAuditLog.id })
      .from(transactionAuditLog)
      .where(
        and(
          eq(transactionAuditLog.transactionId, transactionId),
          eq(transactionAuditLog.householdId, householdId)
        )
      );

    const parsedEntries = auditEntries.map((entry) => ({
      ...entry,
      changes: entry.changes ? JSON.parse(entry.changes) : null,
      snapshot: entry.snapshot ? JSON.parse(entry.snapshot) : null,
    }));

    return Response.json({
      data: parsedEntries,
      total: totalResult.length,
      limit,
      offset,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction audit fetch error:',
    });
  }
}
