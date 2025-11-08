import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { format, parse } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar/month
 * Get transaction and bill summaries for each day in a month range
 * Query params: startDate, endDate
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    // TODO: Add bill counts when bill system is implemented
    // For now, billDueCount and billOverdueCount remain 0

    return Response.json({
      daySummaries,
      month: format(startDate, 'yyyy-MM'),
    });
  } catch (error) {
    console.error('Error fetching calendar month data:', error);
    return Response.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
}
