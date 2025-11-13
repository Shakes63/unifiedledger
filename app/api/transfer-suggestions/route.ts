import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transferSuggestions, transactions, accounts } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

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

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'pending';

    // Validate status parameter
    const validStatuses = ['pending', 'accepted', 'rejected', 'expired'] as const;
    type ValidStatus = typeof validStatuses[number];
    const status: ValidStatus = validStatuses.includes(statusParam as ValidStatus)
      ? (statusParam as ValidStatus)
      : 'pending';

    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

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
        eq(transferSuggestions.sourceTransactionId, transactions.id)
      )
      .leftJoin(
        accounts,
        eq(transactions.accountId, accounts.id)
      )
      .leftJoin(
        sql`transactions as st`,
        sql`${transferSuggestions.suggestedTransactionId} = st.id`
      )
      .leftJoin(
        sql`accounts as sa`,
        sql`${transactions.accountId} = sa.id`
      )
      .leftJoin(
        sql`accounts as sga`,
        sql`st.account_id = sga.id`
      )
      .where(
        and(
          eq(transferSuggestions.userId, userId),
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching transfer suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
