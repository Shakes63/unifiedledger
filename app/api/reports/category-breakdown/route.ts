import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import {
  getTransactionsByDateRange,
  getCurrentMonthRange,
  getCurrentYearRange,
  groupByCategory,
  calculateSum,
  getUserCategories,
} from '@/lib/reports/report-utils';

/**
 * GET /api/reports/category-breakdown
 * Returns spending breakdown by category
 * Query params:
 * - period: 'month' | 'year'
 * - type: 'income' | 'expense' (default: expense)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const period = request.nextUrl.searchParams.get('period') || 'month';
    const txnType = request.nextUrl.searchParams.get('type') || 'expense';

    let range;
    if (period === 'year') {
      range = getCurrentYearRange();
    } else {
      range = getCurrentMonthRange();
    }

    const txns = await getTransactionsByDateRange(userId, range.startDate, range.endDate);

    // Filter by type and remove transfers
    const filteredTxns = txns.filter((t) => t.type === txnType && !t.type.includes('transfer'));

    // Group by category
    const grouped = groupByCategory(filteredTxns);

    // Get category names
    const categories = await getUserCategories(userId);
    const categoryMap = new Map(categories.map((c: any) => [c.id, c]));

    // Build data
    const data = Array.from(grouped.entries()).map(([categoryId, txns]) => {
      const category = categoryMap.get(categoryId);
      const amount = calculateSum(txns);

      return {
        name: category?.name || 'Uncategorized',
        value: Math.abs(amount),
        amount: Math.abs(amount),
        count: txns.length,
        categoryId: categoryId || 'uncategorized',
      };
    });

    // Sort by amount descending
    data.sort((a, b) => b.value - a.value);

    return NextResponse.json({ data, period, type: txnType });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error generating category breakdown report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
