import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
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
    let range;
    if (startDateParam && endDateParam) {
      range = { startDate: startDateParam, endDate: endDateParam };
    } else if (period === 'year') {
      range = getCurrentYearRange();
    } else if (period === '12months') {
      const endDate = new Date();
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
      range = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    } else {
      range = getCurrentMonthRange();
    }

    // Validate date range
    if (new Date(range.startDate) > new Date(range.endDate)) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Validate date range is not too large (max 5 years)
    const daysDiff = Math.ceil(
      (new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
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
    if (merchantIds && merchantIds.length > 0) filters.merchantIds = merchantIds;
    // Note: categoryIds filter is applied after grouping

    // Get transactions
    const txns = await getTransactionsByDateRange(
      userId,
      householdId,
      range.startDate,
      range.endDate,
      filters
    );

    // Filter for expenses only
    const expenses = txns.filter((t) => t.type === 'expense' && !t.type.includes('transfer'));

    // Apply category filter after fetching
    let finalExpenses = expenses;
    if (categoryIds && categoryIds.length > 0) {
      finalExpenses = expenses.filter((t) => t.categoryId && categoryIds.includes(t.categoryId));
    }

    // Group by category
    const grouped = groupByCategory(finalExpenses);

    // Get categories with budgets
    const categories = await getUserCategories(userId, householdId);

    // Build comparison data
    const data = categories
      .filter((c: typeof categories[0]) => c.type === 'expense')
      .map((category: typeof categories[0]) => {
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
      period: period || (startDateParam && endDateParam ? 'custom' : 'month'),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error generating budget vs actual report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
