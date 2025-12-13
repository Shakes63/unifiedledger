import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import {
  getTransactionsByDateRange,
  getLast12MonthsRanges,
  formatMonthLabel,
  calculateDateRange,
} from '@/lib/reports/report-utils';

/**
 * GET /api/reports/cash-flow
 * Returns cash flow analysis (inflows vs outflows)
 * Query params:
 * - period: 'month' | 'year' | '12months' (optional, used if startDate/endDate not provided)
 * - startDate: ISO date string (optional, custom date range start)
 * - endDate: ISO date string (optional, custom date range end)
 * - accountIds: comma-separated account IDs (optional)
 * - categoryIds: comma-separated category IDs (optional)
 * - merchantIds: comma-separated merchant IDs (optional)
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
    const categoryIdsParam = request.nextUrl.searchParams.get('categoryIds');
    const merchantIdsParam = request.nextUrl.searchParams.get('merchantIds');

    // Parse filter arrays
    const accountIds = accountIdsParam ? accountIdsParam.split(',').filter(Boolean) : undefined;
    const categoryIds = categoryIdsParam ? categoryIdsParam.split(',').filter(Boolean) : undefined;
    const merchantIds = merchantIdsParam ? merchantIdsParam.split(',').filter(Boolean) : undefined;

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

    // Build filters object
    const filters: {
      accountIds?: string[];
      categoryIds?: string[];
      merchantIds?: string[];
    } = {};
    if (accountIds && accountIds.length > 0) filters.accountIds = accountIds;
    if (categoryIds && categoryIds.length > 0) filters.categoryIds = categoryIds;
    if (merchantIds && merchantIds.length > 0) filters.merchantIds = merchantIds;

    type CashFlowPoint = {
      name: string;
      inflows: number;
      outflows: number;
      netCashFlow: number;
      week?: string;
      month?: string;
    };

    const data: CashFlowPoint[] = [];

    // Determine grouping strategy based on date range
    const daysDiff2 = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (period === 'month' || (daysDiff2 <= 31 && !startDateParam && !endDateParam)) {
      // Group by week for month view
      const start = new Date(startDate);
      const end = new Date(endDate);
      let currentDate = new Date(start);

      while (currentDate <= end) {
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > end) weekEnd.setTime(end.getTime());

        const startStr = currentDate.toISOString().split('T')[0];
        const endStr = weekEnd.toISOString().split('T')[0];

        const txns = await getTransactionsByDateRange(
          userId,
          householdId,
          startStr,
          endStr,
          filters
        );

        const inflows = txns
          .filter((t) => t.type === 'income' || t.type === 'transfer_in')
          .reduce((sum, t) => sum + t.amount, 0);

        const outflows = Math.abs(
          txns
            .filter((t) => t.type === 'expense' || t.type === 'transfer_out')
            .reduce((sum, t) => sum - t.amount, 0)
        );

        data.push({
          week: startStr,
          name: startStr,
          inflows,
          outflows,
          netCashFlow: inflows - outflows,
        });

        currentDate = new Date(weekEnd);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (period === 'year' || (daysDiff2 <= 365 && !startDateParam && !endDateParam)) {
      // Group by month for year view
      const start = new Date(startDate);
      const end = new Date(endDate);
      let currentDate = new Date(start.getFullYear(), start.getMonth(), 1);

      while (currentDate <= end) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const rangeStart = monthStart < start ? start : monthStart;
        const rangeEnd = monthEnd > end ? end : monthEnd;

        const startStr = rangeStart.toISOString().split('T')[0];
        const endStr = rangeEnd.toISOString().split('T')[0];

        const txns = await getTransactionsByDateRange(
          userId,
          householdId,
          startStr,
          endStr,
          filters
        );

        const inflows = txns
          .filter((t) => t.type === 'income' || t.type === 'transfer_in')
          .reduce((sum, t) => sum + t.amount, 0);

        const outflows = Math.abs(
          txns
            .filter((t) => t.type === 'expense' || t.type === 'transfer_out')
            .reduce((sum, t) => sum - t.amount, 0)
        );

        const monthName = new Date(startStr + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
        });

        data.push({
          month: monthName,
          name: monthName,
          inflows,
          outflows,
          netCashFlow: inflows - outflows,
        });

        currentDate = new Date(monthEnd);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // Group by month for longer ranges (12 months or custom)
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
            startDate: rangeStart.toISOString().split('T')[0],
            endDate: rangeEnd.toISOString().split('T')[0],
          });

          current = new Date(monthEnd);
          current.setDate(current.getDate() + 1);
        }
      }

      const rangesToUse = monthlyRanges.length > 0 ? monthlyRanges : ranges;

      for (const range of rangesToUse) {
        // Skip ranges outside our date range
        if (range.endDate < startDate || range.startDate > endDate) continue;

        const txns = await getTransactionsByDateRange(
          userId,
          householdId,
          range.startDate,
          range.endDate,
          filters
        );

        const inflows = txns
          .filter((t) => t.type === 'income' || t.type === 'transfer_in')
          .reduce((sum, t) => sum + t.amount, 0);

        const outflows = Math.abs(
          txns
            .filter((t) => t.type === 'expense' || t.type === 'transfer_out')
            .reduce((sum, t) => sum - t.amount, 0)
        );

        data.push({
          month: formatMonthLabel(range.startDate),
          name: formatMonthLabel(range.startDate),
          inflows,
          outflows,
          netCashFlow: inflows - outflows,
        });
      }
    }

    return NextResponse.json({ data, period: period || 'custom' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error generating cash flow report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
