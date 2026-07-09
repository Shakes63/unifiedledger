import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { toLocalDateString } from '@/lib/utils/local-date';
import { eq, and, inArray, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { getTodayLocalDateString } from '@/lib/utils/local-date';
import {
  getLast12MonthsRanges,
  calculateDateRange,
  formatMonthLabel,
  calculateNetWorth,
  getAccountBalanceValue,
} from '@/lib/reports/report-utils';

/**
 * GET /api/reports/net-worth
 * Returns net worth history and account breakdown
 * Query params:
 * - period: 'month' | 'year' | '12months' (optional, used if startDate/endDate not provided)
 * - startDate: ISO date string (optional, custom date range start)
 * - endDate: ISO date string (optional, custom date range end)
 * - accountIds: comma-separated account IDs (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return NextResponse.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const period = request.nextUrl.searchParams.get('period');
    const startDateParam = request.nextUrl.searchParams.get('startDate');
    const endDateParam = request.nextUrl.searchParams.get('endDate');
    const accountIdsParam = request.nextUrl.searchParams.get('accountIds');

    // Parse filter arrays
    const accountIds = accountIdsParam ? accountIdsParam.split(',').filter(Boolean) : undefined;

    // Calculate date range
    const { startDate, endDate } = calculateDateRange(period, startDateParam, endDateParam);

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Validate date range is not too large (max 5 years)
    const daysDiff = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 1825) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 5 years' },
        { status: 400 }
      );
    }

    // Build account filter conditions
    const accountConditions = [
      eq(accounts.userId, userId),
      eq(accounts.householdId, householdId),
      eq(accounts.isActive, true),
    ];

    if (accountIds && accountIds.length > 0) {
      accountConditions.push(inArray(accounts.id, accountIds));
    }

    // Get filtered accounts
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(and(...accountConditions));

    // Calculate current net worth by account
    const accountBreakdown = userAccounts.map((account) => ({
      name: account.name,
      balance: getAccountBalanceValue(account),
      type: account.type,
      color: account.color,
    }));

    const currentNetWorth = await calculateNetWorth(userId, householdId);
    
    // Apply account filter to current net worth if needed
    let filteredNetWorth = currentNetWorth;
    if (accountIds && accountIds.length > 0) {
      filteredNetWorth = userAccounts.reduce((sum: number, account) => {
        return sum + getAccountBalanceValue(account);
      }, 0);
    }

    // Derive REAL historical net worth from the ledger (audit finding M-RPT-10:
    // the chart previously repeated the current value for every point). A
    // transaction's effect on net worth is +income / -expense; transfers move
    // money between the household's own accounts and are net-worth-neutral. So
    // net worth at a past date D = current net worth minus the net income/expense
    // that occurred AFTER D (up to today). Respects the same account filter.
    const today = getTodayLocalDateString();
    const netDeltaConditions = [
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId),
      inArray(transactions.type, ['income', 'expense']),
      gte(transactions.date, startDate),
      lte(transactions.date, today),
    ];
    if (accountIds && accountIds.length > 0) {
      netDeltaConditions.push(inArray(transactions.accountId, accountIds));
    }
    const dailyDeltas = await db
      .select({
        date: transactions.date,
        deltaCents: sql<number>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amountCents} ELSE -${transactions.amountCents} END)`,
      })
      .from(transactions)
      .where(and(...netDeltaConditions))
      .groupBy(transactions.date);

    const currentNetWorthCents = Math.round(filteredNetWorth * 100);
    // Net worth (in dollars) as of the END of boundaryDate = current minus the
    // sum of deltas strictly AFTER boundaryDate.
    const netWorthAsOf = (boundaryDate: string): number => {
      let suffix = 0;
      for (const row of dailyDeltas) {
        if (row.date > boundaryDate) suffix += Number(row.deltaCents) || 0;
      }
      return (currentNetWorthCents - suffix) / 100;
    };

    // Calculate historical net worth for chart
    type NetWorthPoint = { name: string; netWorth: number; week?: string; month?: string };
    const historyData: NetWorthPoint[] = [];

    // Determine grouping strategy
    const daysDiff2 = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (period === 'month' || (daysDiff2 <= 31 && !startDateParam && !endDateParam)) {
      // Weekly breakdown for month view
      const start = new Date(startDate);
      const end = new Date(endDate);
      let currentDate = new Date(start);
      let weekCount = 0;

      while (currentDate <= end) {
        weekCount++;
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > end) weekEnd.setTime(end.getTime());

        // Net worth as of the end of this week (M-RPT-10).
        historyData.push({
          week: `Week ${weekCount}`,
          name: `Week ${weekCount}`,
          netWorth: netWorthAsOf(toLocalDateString(weekEnd)),
        });

        currentDate = new Date(weekEnd);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // Monthly breakdown
      const ranges = getLast12MonthsRanges();

      // If custom date range, calculate monthly ranges
      const monthlyRanges: Array<{ startDate: string; endDate: string }> = [];
      if (startDateParam && endDateParam) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        let current = new Date(start.getFullYear(), start.getMonth(), 1);

        while (current <= end) {
          const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
          const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

          const rangeStart = monthStart < start ? start : monthStart;
          const rangeEnd = monthEnd > end ? end : monthEnd;

          monthlyRanges.push({
            startDate: toLocalDateString(rangeStart),
            endDate: toLocalDateString(rangeEnd),
          });

          current = new Date(monthEnd);
          current.setDate(current.getDate() + 1);
        }
      }

      const rangesToUse = monthlyRanges.length > 0 ? monthlyRanges : ranges;

      for (const range of rangesToUse) {
        // Skip ranges outside our date range
        if (range.endDate < startDate || range.startDate > endDate) continue;

        // Net worth as of the end of this month (M-RPT-10).
        const monthLabel = formatMonthLabel(range.startDate);

        historyData.push({
          month: monthLabel,
          name: monthLabel,
          netWorth: netWorthAsOf(range.endDate),
        });
      }
    }

    return NextResponse.json({
      currentNetWorth: filteredNetWorth,
      accountBreakdown,
      history: historyData,
      period: period || (startDateParam && endDateParam ? 'custom' : '12months'),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error generating net worth report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
