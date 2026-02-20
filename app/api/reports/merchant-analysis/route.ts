import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { toLocalDateString } from '@/lib/utils/local-date';
import {
  getTransactionsByDateRange,
  getCurrentMonthRange,
  getCurrentYearRange,
  getTopMerchants,
  calculateSum,
} from '@/lib/reports/report-utils';
import { db } from '@/lib/db';
import { merchants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/reports/merchant-analysis
 * Returns top merchants and spending analysis
 * Query params:
 * - period: 'month' | 'year' | '12months' (optional, used if startDate/endDate not provided)
 * - startDate: ISO date string (optional, custom date range start)
 * - endDate: ISO date string (optional, custom date range end)
 * - accountIds: comma-separated account IDs (optional)
 * - categoryIds: comma-separated category IDs (optional)
 * - merchantIds: comma-separated merchant IDs (optional)
 * - limit: number of top merchants to return (default: 10)
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
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10', 10);

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
        startDate: toLocalDateString(startDate),
        endDate: toLocalDateString(endDate),
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
    if (categoryIds && categoryIds.length > 0) filters.categoryIds = categoryIds;
    // Note: merchantIds filter is applied after grouping (since we're analyzing merchants)

    // Get transactions
    const txns = await getTransactionsByDateRange(
      userId,
      householdId,
      range.startDate,
      range.endDate,
      filters
    );

    // Filter for expenses only
    let expenses = txns.filter((t) => t.type === 'expense' && !t.type.includes('transfer'));

    // Apply merchant filter after fetching (since we're grouping by merchant)
    if (merchantIds && merchantIds.length > 0) {
      expenses = expenses.filter((t) => t.merchantId && merchantIds.includes(t.merchantId));
    }

    // Get top merchants
    const topMerchants = getTopMerchants(expenses, limit);

    // Fetch merchant names for merchantIds
    // Note: merchantIds are nanoid format (longer strings)
    const _merchantIdsFromData = topMerchants
      .map((m) => m.merchant)
      .filter((id) => id && id.length > 10);

    const merchantRecords = await db
      .select()
      .from(merchants)
      .where(and(eq(merchants.userId, userId), eq(merchants.householdId, householdId)));

    const merchantMap = new Map(merchantRecords.map((m) => [m.id, m.name]));

    // Calculate statistics
    const totalSpending = Math.abs(calculateSum(expenses));
    const averageTransaction = expenses.length > 0 ? totalSpending / expenses.length : 0;

    // Convert to display format
    const data = topMerchants.map((merchant) => ({
      name: merchantMap.get(merchant.merchant) || merchant.merchant, // Use merchant name if found, otherwise use description
      amount: Math.abs(merchant.amount),
      count: merchant.count,
      averagePerTransaction: Math.abs(merchant.amount / merchant.count),
      percentageOfTotal: totalSpending > 0 ? (Math.abs(merchant.amount) / totalSpending) * 100 : 0,
    }));

    return NextResponse.json({
      data,
      summary: {
        totalMerchants: new Set(expenses.map((t) => t.merchantId || t.description)).size,
        totalSpending: Math.abs(totalSpending),
        totalTransactions: expenses.length,
        averageTransaction,
        averagePerMerchant:
          expenses.length > 0
            ? totalSpending / new Set(expenses.map((t) => t.merchantId || t.description)).size
            : 0,
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
    console.error('Error generating merchant analysis report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
