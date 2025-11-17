import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, bills, billInstances } from '@/lib/db/schema';
import { eq, and, desc, gte, lte, inArray, asc, sql } from 'drizzle-orm';
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
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const {
      transactionIds = null, // If provided, only match these transactions
      dateStart = null, // If provided, match transactions in date range
      dateEnd = null,
      minConfidence = 70,
      autoLink = false, // If true, automatically link high-confidence matches
      maxTransactions = 100, // Limit to prevent long processing
    } = body;

    // Get user's bills for this household
    const userBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.householdId, householdId),
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

    // Build query for transactions to match (filtered by household)
    const conditions = [
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId),
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

          // Find a pending bill instance for this match (filtered by household)
          const txDate = new Date(result.transaction.date);
          const currentMonth = txDate.getMonth();
          const currentYear = txDate.getFullYear();

          // Look for pending or overdue instance (prioritize overdue)
          // FIX: Include both 'pending' and 'overdue' statuses, prioritize overdue bills
          const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

          const instance = await db
            .select()
            .from(billInstances)
            .where(
              and(
                eq(billInstances.billId, bestMatch.billId),
                eq(billInstances.householdId, householdId),
                inArray(billInstances.status, ['pending', 'overdue'])
              )
            )
            .orderBy(
              // Prioritize overdue bills first (0), then pending (1), then by due date (oldest first)
              sql`CASE WHEN ${billInstances.status} = 'overdue' THEN 0 ELSE 1 END`,
              asc(billInstances.dueDate)
            )
            .limit(1);

          if (instance.length > 0) {
            // Update transaction to link to bill (filtered by household)
            await db
              .update(transactions)
              .set({
                billId: bestMatch.billId,
                updatedAt: new Date().toISOString(),
              })
              .where(
                and(
                  eq(transactions.id, result.transactionId),
                  eq(transactions.householdId, householdId)
                )
              );

            // Update bill instance to mark as paid (filtered by household)
            await db
              .update(billInstances)
              .set({
                status: 'paid',
                paidDate: result.transaction.date,
                actualAmount: result.transaction.amount,
                transactionId: result.transactionId,
                updatedAt: new Date().toISOString(),
              })
              .where(
                and(
                  eq(billInstances.id, instance[0].id),
                  eq(billInstances.householdId, householdId)
                )
              );

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
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
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
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const daysBack = parseInt(url.searchParams.get('daysBack') || '90');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get unmatched expense transactions (filtered by household)
    const unmatchedTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId),
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
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching unmatched transactions:', error);
    return Response.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
