import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import {
  getTransactionsByDateRange,
  getLast12MonthsRanges,
  calculateByType,
  formatMonthLabel,
} from '@/lib/reports/report-utils';

/**
 * GET /api/reports/cash-flow
 * Returns cash flow analysis (inflows vs outflows)
 * Query params:
 * - period: 'month' | 'year' | '12months'
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const period = request.nextUrl.searchParams.get('period') || '12months';

    let data: any[] = [];

    if (period === '12months') {
      const ranges = getLast12MonthsRanges();

      for (const range of ranges) {
        const txns = await getTransactionsByDateRange(userId, range.startDate, range.endDate);

        // Separate by type
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
          inflows,
          outflows,
          netCashFlow: inflows - outflows,
        });
      }
    } else if (period === 'year') {
      const now = new Date();
      const currentYear = now.getFullYear();

      for (let month = 0; month < 12; month++) {
        const startDate = new Date(currentYear, month, 1).toISOString().split('T')[0];
        const endDate = new Date(currentYear, month + 1, 0).toISOString().split('T')[0];

        const txns = await getTransactionsByDateRange(userId, startDate, endDate);

        const inflows = txns
          .filter((t) => t.type === 'income' || t.type === 'transfer_in')
          .reduce((sum, t) => sum + t.amount, 0);

        const outflows = Math.abs(
          txns
            .filter((t) => t.type === 'expense' || t.type === 'transfer_out')
            .reduce((sum, t) => sum - t.amount, 0)
        );

        const monthName = new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
        });

        data.push({
          month: monthName,
          inflows,
          outflows,
          netCashFlow: inflows - outflows,
        });
      }
    } else if (period === 'month') {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const txns = await getTransactionsByDateRange(userId, startDate, endDate);

      // Group by week
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      let currentDate = new Date(startOfMonth);

      while (currentDate.getMonth() === startOfMonth.getMonth()) {
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);

        if (weekEnd.getMonth() !== startOfMonth.getMonth()) {
          weekEnd.setDate(new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate());
        }

        const startStr = currentDate.toISOString().split('T')[0];
        const endStr = weekEnd.toISOString().split('T')[0];

        const weekTxns = txns.filter((t) => t.date >= startStr && t.date <= endStr);

        const inflows = weekTxns
          .filter((t) => t.type === 'income' || t.type === 'transfer_in')
          .reduce((sum, t) => sum + t.amount, 0);

        const outflows = Math.abs(
          weekTxns
            .filter((t) => t.type === 'expense' || t.type === 'transfer_out')
            .reduce((sum, t) => sum - t.amount, 0)
        );

        data.push({
          week: startStr,
          inflows,
          outflows,
          netCashFlow: inflows - outflows,
        });

        currentDate = new Date(weekEnd);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return NextResponse.json({ data, period });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error generating cash flow report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
