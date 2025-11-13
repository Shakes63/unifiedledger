import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions, billInstances, bills } from '@/lib/db/schema';
import { eq, and, gte, lte, lt } from 'drizzle-orm';
import { format, parse } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar/month
 * Get transaction and bill summaries for each day in a month range
 * Query params: startDate, endDate
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return Response.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Update any pending bills that are now overdue
    const today = format(new Date(), 'yyyy-MM-dd');
    await db
      .update(billInstances)
      .set({ status: 'overdue' })
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.status, 'pending'),
          lt(billInstances.dueDate, today)
        )
      );

    // Get all transactions for the month
    const monthTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, format(startDate, 'yyyy-MM-dd')),
          lte(transactions.date, format(endDate, 'yyyy-MM-dd'))
        )
      );

    // Group transactions by date and calculate summaries
    const daySummaries: Record<
      string,
      {
        incomeCount: number;
        expenseCount: number;
        transferCount: number;
        totalSpent: number;
        billDueCount: number;
        billOverdueCount: number;
        bills?: Array<{ name: string; status: string; amount: number }>;
      }
    > = {};

    for (const txn of monthTransactions) {
      const dateKey = txn.date;

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = {
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0,
          totalSpent: 0,
          billDueCount: 0,
          billOverdueCount: 0,
          bills: [],
        };
      }

      const summary = daySummaries[dateKey];

      // Count by type
      if (txn.type === 'income') {
        summary.incomeCount++;
      } else if (txn.type === 'expense') {
        summary.expenseCount++;
        summary.totalSpent += Math.abs(
          parseFloat(txn.amount?.toString() || '0')
        );
      } else if (
        txn.type === 'transfer_in' ||
        txn.type === 'transfer_out'
      ) {
        summary.transferCount++;
      }
    }

    // Get all bill instances for the month
    const monthBillInstances = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.userId, userId),
          gte(billInstances.dueDate, format(startDate, 'yyyy-MM-dd')),
          lte(billInstances.dueDate, format(endDate, 'yyyy-MM-dd'))
        )
      );

    // Add bill details to day summaries
    for (const billInstance of monthBillInstances) {
      const dateKey = billInstance.dueDate;

      if (!daySummaries[dateKey]) {
        daySummaries[dateKey] = {
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0,
          totalSpent: 0,
          billDueCount: 0,
          billOverdueCount: 0,
          bills: [],
        };
      }

      // Get bill name
      const bill = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.id, billInstance.billId),
            eq(bills.userId, userId)
          )
        )
        .limit(1);

      if (bill.length > 0) {
        daySummaries[dateKey].bills = daySummaries[dateKey].bills || [];
        daySummaries[dateKey].bills!.push({
          name: bill[0].name,
          status: billInstance.status || 'pending',
          amount: billInstance.expectedAmount,
        });
      }

      if (billInstance.status === 'overdue') {
        daySummaries[dateKey].billOverdueCount++;
      } else if (billInstance.status === 'pending') {
        daySummaries[dateKey].billDueCount++;
      }
    }

    return Response.json({
      daySummaries,
      month: format(startDate, 'yyyy-MM'),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching calendar month data:', error);
    return Response.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
}
