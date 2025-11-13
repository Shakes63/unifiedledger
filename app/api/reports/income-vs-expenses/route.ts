import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import {
  getTransactionsByDateRange,
  getLast12MonthsRanges,
  calculateByType,
  formatMonthLabel,
} from '@/lib/reports/report-utils';

/**
 * GET /api/reports/income-vs-expenses
 * Returns income vs expenses data for charts
 * Query params:
 * - period: 'month' (current month) | 'year' (current year) | '12months' (last 12 months)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const period = request.nextUrl.searchParams.get('period') || '12months';

    let data: any[] = [];

    if (period === '12months') {
      // Last 12 months
      const ranges = getLast12MonthsRanges();

      for (const range of ranges) {
        const txns = await getTransactionsByDateRange(userId, range.startDate, range.endDate);

        // Filter out transfers
        const nonTransferTxns = txns.filter((t) => !t.type.includes('transfer'));

        // Group by type
        const byType = calculateByType(nonTransferTxns);

        data.push({
          month: formatMonthLabel(range.startDate),
          income: byType.income || 0,
          expenses: Math.abs(byType.expense || 0),
          net: (byType.income || 0) - Math.abs(byType.expense || 0),
        });
      }
    } else if (period === 'year') {
      // Current year by month
      const now = new Date();
      const currentYear = now.getFullYear();

      for (let month = 0; month < 12; month++) {
        const startDate = new Date(currentYear, month, 1).toISOString().split('T')[0];
        const endDate = new Date(currentYear, month + 1, 0).toISOString().split('T')[0];

        const txns = await getTransactionsByDateRange(userId, startDate, endDate);

        // Filter out transfers
        const nonTransferTxns = txns.filter((t) => !t.type.includes('transfer'));

        // Group by type
        const byType = calculateByType(nonTransferTxns);

        const monthName = new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
        });

        data.push({
          month: monthName,
          income: byType.income || 0,
          expenses: Math.abs(byType.expense || 0),
          net: (byType.income || 0) - Math.abs(byType.expense || 0),
        });
      }
    } else if (period === 'month') {
      // Current month by week
      const now = new Date();
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

        const txns = await getTransactionsByDateRange(userId, startStr, endStr);

        // Filter out transfers
        const nonTransferTxns = txns.filter((t) => !t.type.includes('transfer'));

        // Group by type
        const byType = calculateByType(nonTransferTxns);

        data.push({
          week: `Week of ${startStr}`,
          income: byType.income || 0,
          expenses: Math.abs(byType.expense || 0),
          net: (byType.income || 0) - Math.abs(byType.expense || 0),
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
    console.error('Error generating income vs expenses report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
