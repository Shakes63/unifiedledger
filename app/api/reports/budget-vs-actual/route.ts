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
 * GET /api/reports/budget-vs-actual
 * Returns budget vs actual spending comparison
 * Query params:
 * - period: 'month' | 'year'
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const period = request.nextUrl.searchParams.get('period') || 'month';

    let range;
    if (period === 'year') {
      range = getCurrentYearRange();
    } else {
      range = getCurrentMonthRange();
    }

    // Get transactions
    const txns = await getTransactionsByDateRange(userId, range.startDate, range.endDate);

    // Filter for expenses only
    const expenses = txns.filter((t) => t.type === 'expense' && !t.type.includes('transfer'));

    // Group by category
    const grouped = groupByCategory(expenses);

    // Get categories with budgets
    const categories = await getUserCategories(userId);

    // Build comparison data
    const data = categories
      .filter((c: any) => c.type === 'variable_expense' || c.type === 'monthly_bill')
      .map((category: any) => {
        const categoryTxns = grouped.get(category.id) || [];
        const actual = Math.abs(calculateSum(categoryTxns));
        const budget = category.monthlyBudget || 0;
        const variance = budget - actual;
        const percentageUsed = budget > 0 ? (actual / budget) * 100 : 0;

        return {
          name: category.name,
          budget,
          actual,
          variance,
          percentageUsed: Math.min(percentageUsed, 100),
          status: actual > budget ? 'over' : actual > budget * 0.8 ? 'warning' : 'on_track',
          categoryId: category.id,
        };
      });

    // Calculate totals
    const totalBudget = data.reduce((sum, item) => sum + item.budget, 0);
    const totalActual = data.reduce((sum, item) => sum + item.actual, 0);
    const totalVariance = totalBudget - totalActual;

    // Sort by actual spending descending
    data.sort((a, b) => b.actual - a.actual);

    return NextResponse.json({
      data,
      summary: {
        totalBudget,
        totalActual,
        totalVariance,
        remainingBudget: Math.max(totalBudget - totalActual, 0),
        overBudgetAmount: Math.max(totalActual - totalBudget, 0),
      },
      period,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error generating budget vs actual report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
