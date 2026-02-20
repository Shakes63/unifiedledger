import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transferSuggestions, transactions } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { handleRouteError } from '@/lib/api/route-helpers';

/**
 * GET /api/transfer-suggestions
 * Fetch transfer match suggestions for the current user
 *
 * Query params:
 * - status: Filter by status (pending, accepted, rejected, expired)
 * - limit: Number of results (default: 20)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'pending';

    // Validate status parameter
    const validStatuses = ['pending', 'accepted', 'rejected', 'expired'] as const;
    type ValidStatus = typeof validStatuses[number];
    const status: ValidStatus = validStatuses.includes(statusParam as ValidStatus)
      ? (statusParam as ValidStatus)
      : 'pending';

    const limitParam = Number.parseInt(searchParams.get('limit') || '20', 10);
    const offsetParam = Number.parseInt(searchParams.get('offset') || '0', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

    // Fetch suggestions with joined transaction and account details
    const suggestions = await db
      .select({
        suggestion: transferSuggestions,
        sourceTransaction: transactions,
        suggestedTransaction: {
          id: sql`st.id`,
          userId: sql`st.user_id`,
          accountId: sql`st.account_id`,
          date: sql`st.date`,
          amount: sql`st.amount`,
          description: sql`st.description`,
          type: sql`st.type`,
          notes: sql`st.notes`,
          categoryId: sql`st.category_id`,
          merchantId: sql`st.merchant_id`,
        },
        sourceAccount: {
          id: sql`sa.id`,
          name: sql`sa.name`,
          color: sql`sa.color`,
          icon: sql`sa.icon`,
          type: sql`sa.type`,
        },
        suggestedAccount: {
          id: sql`sga.id`,
          name: sql`sga.name`,
          color: sql`sga.color`,
          icon: sql`sga.icon`,
          type: sql`sga.type`,
        },
      })
      .from(transferSuggestions)
      .leftJoin(
        transactions,
        and(
          eq(transferSuggestions.sourceTransactionId, transactions.id),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .leftJoin(
        sql`transactions as st`,
        sql`${transferSuggestions.suggestedTransactionId} = st.id
            AND st.user_id = ${userId}
            AND st.household_id = ${householdId}`
      )
      .leftJoin(
        sql`accounts as sa`,
        sql`${transactions.accountId} = sa.id
            AND sa.user_id = ${userId}
            AND sa.household_id = ${householdId}`
      )
      .leftJoin(
        sql`accounts as sga`,
        sql`st.account_id = sga.id
            AND sga.user_id = ${userId}
            AND sga.household_id = ${householdId}`
      )
      .where(
        and(
          eq(transferSuggestions.userId, userId),
          eq(transferSuggestions.householdId, householdId),
          eq(transferSuggestions.status, status)
        )
      )
      .orderBy(desc(transferSuggestions.totalScore))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(transferSuggestions)
      .where(
        and(
          eq(transferSuggestions.userId, userId),
          eq(transferSuggestions.householdId, householdId),
          eq(transferSuggestions.status, status)
        )
      );

    const total = totalResult[0]?.count || 0;

    return NextResponse.json({
      data: suggestions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to fetch suggestions',
      logLabel: 'Error fetching transfer suggestions:',
    });
  }
}
