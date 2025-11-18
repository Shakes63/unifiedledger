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
  calculateDateRange,
} from '@/lib/reports/report-utils';

/**
 * GET /api/reports/category-breakdown
 * Returns spending breakdown by category
 * Query params:
 * - period: 'month' | 'year' | '12months' (optional, used if startDate/endDate not provided)
 * - startDate: ISO date string (optional, custom date range start)
 * - endDate: ISO date string (optional, custom date range end)
 * - type: 'income' | 'expense' (default: expense)
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
    const txnType = request.nextUrl.searchParams.get('type') || 'expense';
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
      // For 12 months, use last 12 months range
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

    // Build filters object (exclude categoryIds from transaction filter since we're grouping by category)
    const filters: {
      accountIds?: string[];
      categoryIds?: string[];
      merchantIds?: string[];
    } = {};
    if (accountIds && accountIds.length > 0) filters.accountIds = accountIds;
    if (merchantIds && merchantIds.length > 0) filters.merchantIds = merchantIds;
    // Note: categoryIds filter is applied after grouping, not in transaction query

    const txns = await getTransactionsByDateRange(
      userId,
      householdId,
      range.startDate,
      range.endDate,
      filters
    );

    // Filter by type and remove transfers
    const filteredTxns = txns.filter(
      (t) => t.type === txnType && !t.type.includes('transfer')
    );

    // Apply category filter after fetching (since we're grouping by category)
    let finalTxns = filteredTxns;
    if (categoryIds && categoryIds.length > 0) {
      finalTxns = filteredTxns.filter((t) => t.categoryId && categoryIds.includes(t.categoryId));
    }

    // Group by category
    const grouped = groupByCategory(finalTxns);

    // Get category names
    const categories = await getUserCategories(userId, householdId);
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

    return NextResponse.json({
      data,
      period: period || (startDateParam && endDateParam ? 'custom' : 'month'),
      type: txnType,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error generating category breakdown report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
