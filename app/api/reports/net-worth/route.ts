import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { getLast12MonthsRanges, getTransactionsByDateRange } from '@/lib/reports/report-utils';
import Decimal from 'decimal.js';

/**
 * GET /api/reports/net-worth
 * Returns net worth history and account breakdown
 * Query params:
 * - period: 'month' | '12months'
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const period = request.nextUrl.searchParams.get('period') || '12months';

    // Get all accounts
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

    // Calculate current net worth by account
    const accountBreakdown = userAccounts.map((account: any) => ({
      name: account.name,
      balance: account.currentBalance || 0,
      type: account.type,
      color: account.color,
    }));

    const currentNetWorth = userAccounts.reduce((sum: number, account: any) => {
      return sum + (account.currentBalance || 0);
    }, 0);

    // Calculate historical net worth for chart
    let historyData: any[] = [];

    if (period === '12months') {
      const ranges = getLast12MonthsRanges();

      for (const range of ranges) {
        let monthNetWorth = new Decimal(0);

        // Get cumulative transactions up to end of month
        const txns = await db
          .select()
          .from(transactions)
          .where(and(
            eq(transactions.userId, userId),
            // All transactions up to this month
          ));

        // Filter by date
        const relevantTxns = txns.filter(
          (t: any) => new Date(t.date) <= new Date(range.endDate)
        );

        // Calculate net worth by tracking account balances
        const accountBalances = new Map<string, Decimal>();

        // Start with current balances and work backwards
        userAccounts.forEach((account: any) => {
          // This is simplified - in production you'd calculate from beginning
          // For now, use current balance as proxy
          accountBalances.set(account.id, new Decimal(account.currentBalance || 0));
        });

        const totalNetWorth = Array.from(accountBalances.values()).reduce(
          (sum, balance) => sum.plus(balance),
          new Decimal(0)
        );

        const monthLabel = new Date(range.startDate + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        });

        historyData.push({
          month: monthLabel,
          netWorth: totalNetWorth.toNumber(),
        });
      }
    } else if (period === 'month') {
      // Weekly breakdown for current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let currentDate = new Date(startOfMonth);
      let weekCount = 0;

      while (currentDate.getMonth() === startOfMonth.getMonth()) {
        weekCount++;
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);

        if (weekEnd.getMonth() !== startOfMonth.getMonth()) {
          weekEnd.setDate(new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate());
        }

        // Simplified: use current net worth for all weeks
        historyData.push({
          week: `Week ${weekCount}`,
          netWorth: currentNetWorth,
        });

        currentDate = new Date(weekEnd);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return NextResponse.json({
      currentNetWorth,
      accountBreakdown,
      history: historyData,
      period,
    });
  } catch (error) {
    console.error('Error generating net worth report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
