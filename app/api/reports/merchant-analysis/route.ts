import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getTransactionsByDateRange,
  getCurrentMonthRange,
  getCurrentYearRange,
  getTopMerchants,
} from '@/lib/reports/report-utils';

/**
 * GET /api/reports/merchant-analysis
 * Returns top merchants and spending analysis
 * Query params:
 * - period: 'month' | 'year'
 * - limit: number of top merchants to return (default: 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const period = request.nextUrl.searchParams.get('period') || 'month';
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10', 10);

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

    // Get top merchants
    const topMerchants = getTopMerchants(expenses, limit);

    // Calculate statistics
    const totalSpending = expenses.reduce((sum, t) => sum + t.amount, 0);
    const averageTransaction = expenses.length > 0 ? totalSpending / expenses.length : 0;

    // Convert to display format
    const data = topMerchants.map((merchant) => ({
      name: merchant.merchant,
      amount: Math.abs(merchant.amount),
      count: merchant.count,
      averagePerTransaction: Math.abs(merchant.amount / merchant.count),
      percentageOfTotal: totalSpending > 0 ? (Math.abs(merchant.amount) / totalSpending) * 100 : 0,
    }));

    return NextResponse.json({
      data,
      summary: {
        totalMerchants: new Set(expenses.map((t) => t.description)).size,
        totalSpending: Math.abs(totalSpending),
        totalTransactions: expenses.length,
        averageTransaction,
        averagePerMerchant: expenses.length > 0 ? totalSpending / new Set(expenses.map((t) => t.description)).size : 0,
      },
      period,
    });
  } catch (error) {
    console.error('Error generating merchant analysis report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
