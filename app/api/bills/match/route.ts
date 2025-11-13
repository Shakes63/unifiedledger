import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions, bills, billInstances } from '@/lib/db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { findMatchingBills, BillMatch } from '@/lib/bills/bill-matcher';

export const dynamic = 'force-dynamic';

/**
 * POST - Analyze transactions and find matching bills
 * This endpoint doesn't modify data, just returns potential matches
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const {
      transactionIds = null, // If provided, only match these transactions
      dateStart = null, // If provided, match transactions in date range
      dateEnd = null,
      minConfidence = 70,
      autoLink = false, // If true, automatically link high-confidence matches
      maxTransactions = 100, // Limit to prevent long processing
    } = body;

    // Get user's bills
    const userBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.isActive, true)
        )
      );

    if (userBills.length === 0) {
      return Response.json({
        matched: 0,
        linked: 0,
        results: [],
        message: 'No active bills configured',
      });
    }

    // Build query for transactions to match
    const conditions = [
      eq(transactions.userId, userId),
      eq(transactions.type, 'expense'),
    ];

    if (dateStart) {
      conditions.push(gte(transactions.date, dateStart));
    }
    if (dateEnd) {
      conditions.push(lte(transactions.date, dateEnd));
    }

    let txList = await db
      .select()
      .from(transactions)
      .where(conditions.length === 1 ? conditions[0] : and(...(conditions as any)))
      .orderBy(desc(transactions.date))
      .limit(maxTransactions);

    // Filter by transaction IDs if provided
    if (transactionIds && Array.isArray(transactionIds) && transactionIds.length > 0) {
      const idSet = new Set(transactionIds);
      txList = txList.filter((tx) => idSet.has(tx.id));
    }

    // Prepare data for matching
    const txForMatching = txList.map((tx) => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
      type: tx.type,
    }));

    const billsForMatching = userBills.map((bill) => ({
      id: bill.id,
      name: bill.name,
      expectedAmount: bill.expectedAmount,
      dueDate: bill.dueDate,
      isVariableAmount: bill.isVariableAmount,
      amountTolerance: bill.amountTolerance,
      payeePatterns: bill.payeePatterns ? JSON.parse(bill.payeePatterns) : [],
    }));

    // Run matching algorithm
    const matchResults: Array<{
      transactionId: string;
      transaction: typeof txList[0];
      matches: BillMatch[];
    }> = [];

    for (const tx of txForMatching) {
      const matches = await findMatchingBills(tx, billsForMatching);
      const transaction = txList.find((t) => t.id === tx.id);

      if (transaction) {
        matchResults.push({
          transactionId: tx.id,
          transaction,
          matches: matches.filter((m) => m.confidence >= minConfidence),
        });
      }
    }

    // If autoLink is enabled, link high-confidence matches
    let linkedCount = 0;

    if (autoLink) {
      for (const result of matchResults) {
        if (result.matches.length > 0) {
          const bestMatch = result.matches[0];

          // Skip if already linked to a bill
          if (result.transaction.billId) {
            continue;
          }

          // Find a pending bill instance for this match
          const txDate = new Date(result.transaction.date);
          const currentMonth = txDate.getMonth();
          const currentYear = txDate.getFullYear();

          // Look for pending instance in current or previous month
          const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

          const instance = await db
            .select()
            .from(billInstances)
            .where(
              and(
                eq(billInstances.billId, bestMatch.billId),
                eq(billInstances.status, 'pending')
              )
            )
            .limit(1);

          if (instance.length > 0) {
            // Update transaction to link to bill
            await db
              .update(transactions)
              .set({
                billId: bestMatch.billId,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(transactions.id, result.transactionId));

            // Update bill instance to mark as paid
            await db
              .update(billInstances)
              .set({
                status: 'paid',
                paidDate: result.transaction.date,
                actualAmount: result.transaction.amount,
                transactionId: result.transactionId,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(billInstances.id, instance[0].id));

            linkedCount++;
          }
        }
      }
    }

    return Response.json({
      analyzed: txForMatching.length,
      matched: matchResults.filter((r) => r.matches.length > 0).length,
      linked: linkedCount,
      results: matchResults.map((r) => ({
        transactionId: r.transactionId,
        description: r.transaction.description,
        amount: r.transaction.amount,
        date: r.transaction.date,
        matches: r.matches,
        bestMatch: r.matches.length > 0 ? r.matches[0] : null,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error matching bills:', error);
    return Response.json(
      { error: 'Failed to match bills' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get recent unmatched transactions that might be bills
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const daysBack = parseInt(url.searchParams.get('daysBack') || '90');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get unmatched expense transactions
    const unmatchedTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense')
          // billId is null - unmatched
        )
      )
      .orderBy(desc(transactions.date))
      .limit(limit);

    return Response.json({
      count: unmatchedTransactions.length,
      transactions: unmatchedTransactions.map((tx) => ({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        categoryId: tx.categoryId,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching unmatched transactions:', error);
    return Response.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
