import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { toLocalDateString } from '@/lib/utils/local-date';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
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

        // Simplified: use current net worth for all weeks
        // In a full implementation, you'd calculate historical balances
        historyData.push({
          week: `Week ${weekCount}`,
          name: `Week ${weekCount}`,
          netWorth: filteredNetWorth,
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

        // Simplified: use current net worth for all months
        // In a full implementation, you'd calculate historical balances from transactions
        const monthLabel = formatMonthLabel(range.startDate);

        historyData.push({
          month: monthLabel,
          name: monthLabel,
          netWorth: filteredNetWorth,
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
