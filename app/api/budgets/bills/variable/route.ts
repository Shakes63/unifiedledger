import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { bills, billInstances } from '@/lib/db/schema';
import { getMonthRangeForYearMonth, toLocalDateString } from '@/lib/utils/local-date';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface VariableBillData {
  id: string;
  name: string;
  frequency: string | null;
  expectedAmount: number;
  currentMonth: {
    month: string;
    instanceId: string | null;
    expectedAmount: number;
    actualAmount: number | null;
    variance: number | null;
    variancePercent: number | null;
    status: 'pending' | 'paid' | 'overdue' | 'skipped';
    dueDate: string;
    paidDate: string | null;
  };
  historicalAverages: {
    threeMonth: number | null;
    sixMonth: number | null;
    twelveMonth: number | null;
    allTime: number | null;
  };
  monthlyBreakdown: Array<{
    month: string;
    expected: number;
    actual: number | null;
    variance: number | null;
    status: 'pending' | 'paid' | 'overdue' | 'skipped' | null;
  }>;
  trend: {
    direction: 'improving' | 'worsening' | 'stable';
    percentChange: number;
    recommendedBudget: number;
  };
}

interface VariableBillSummary {
  totalExpected: number;
  totalActual: number;
  totalVariance: number;
  variancePercent: number;
  billCount: number;
  paidCount: number;
  pendingCount: number;
}

/**
 * Calculate average from an array of bill instances
 */
function calculateAverage(instances: Array<{ actualAmount: number | null }>): number | null {
  const validInstances = instances.filter(i => i.actualAmount !== null);
  if (validInstances.length === 0) return null;

  const sum = validInstances.reduce(
    (acc, i) => acc.plus(new Decimal(i.actualAmount!)),
    new Decimal(0)
  );

  return sum.div(validInstances.length).toDecimalPlaces(2).toNumber();
}

/**
 * Determine trend direction by comparing recent vs previous periods
 */
function calculateTrend(
  instances: Array<{ actualAmount: number | null; dueDate: string }>
): {
  direction: 'improving' | 'worsening' | 'stable';
  percentChange: number;
} {
  // Filter paid instances only
  const paidInstances = instances.filter(i => i.actualAmount !== null);

  if (paidInstances.length < 4) {
    // Not enough data for trend analysis
    return { direction: 'stable', percentChange: 0 };
  }

  // Sort by due date descending (most recent first)
  const sortedInstances = [...paidInstances].sort(
    (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
  );

  // Compare recent 3 months vs previous 3 months
  const recent3 = sortedInstances.slice(0, 3);
  const previous3 = sortedInstances.slice(3, 6);

  if (previous3.length === 0) {
    return { direction: 'stable', percentChange: 0 };
  }

  const recentAvg = calculateAverage(recent3);
  const previousAvg = calculateAverage(previous3);

  if (recentAvg === null || previousAvg === null || previousAvg === 0) {
    return { direction: 'stable', percentChange: 0 };
  }

  const percentChange = new Decimal(recentAvg)
    .minus(previousAvg)
    .div(previousAvg)
    .times(100)
    .toDecimalPlaces(1)
    .toNumber();

  let direction: 'improving' | 'worsening' | 'stable' = 'stable';

  if (percentChange < -5) {
    direction = 'improving'; // Costs decreasing
  } else if (percentChange > 5) {
    direction = 'worsening'; // Costs increasing
  }

  return { direction, percentChange };
}

/**
 * Calculate recommended budget based on historical data
 */
function calculateRecommendedBudget(
  instances: Array<{ actualAmount: number | null }>,
  trendDirection: 'improving' | 'worsening' | 'stable',
  currentExpected: number
): number {
  // Use 6-month average + buffer
  const last6 = instances.slice(0, 6);
  const sixMonthAvg = calculateAverage(last6);

  if (sixMonthAvg === null) {
    // No data, return current expected amount
    return currentExpected;
  }

  // Apply buffer based on trend
  const buffer = trendDirection === 'worsening' ? 1.15 : 1.10;
  const recommended = new Decimal(sixMonthAvg)
    .times(buffer)
    .toDecimalPlaces(2)
    .toNumber();

  return recommended;
}

/**
 * GET /api/budgets/bills/variable
 *
 * Query Parameters:
 * - month: YYYY-MM format (optional, defaults to current month)
 * - billId: Filter to specific bill (optional)
 *
 * Returns comprehensive variable bill tracking data
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get query parameters
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');
    const billIdParam = url.searchParams.get('billId');

    // Parse month or default to current month
    let year: number;
    let month: number;

    if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-');
      year = parseInt(yearStr);
      month = parseInt(monthStr);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    // Calculate date range for current month
    const { startDate: monthStart, endDate: monthEnd } = getMonthRangeForYearMonth(year, month);

    // Query variable bills for this user and household
    const billsQuery = db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.householdId, householdId),
          eq(bills.isVariableAmount, true),
          eq(bills.isActive, true)
        )
      );

    // If billId specified, filter to that bill
    const variableBills = billIdParam
      ? (await billsQuery).filter(b => b.id === billIdParam)
      : await billsQuery;

    if (variableBills.length === 0) {
      return Response.json({
        month: monthStr,
        summary: {
          totalExpected: 0,
          totalActual: 0,
          totalVariance: 0,
          variancePercent: 0,
          billCount: 0,
          paidCount: 0,
          pendingCount: 0,
        },
        bills: [],
      });
    }

    // Process each variable bill
    const billsData: VariableBillData[] = [];
    let summaryTotalExpected = new Decimal(0);
    let summaryTotalActual = new Decimal(0);
    let summaryPaidCount = 0;
    let summaryPendingCount = 0;

    for (const bill of variableBills) {
      // Get current month's bill instance
      const currentMonthInstances = await db
        .select()
        .from(billInstances)
        .where(
          and(
            eq(billInstances.billId, bill.id),
            gte(billInstances.dueDate, monthStart),
            lte(billInstances.dueDate, monthEnd)
          )
        );

      const currentInstance = currentMonthInstances[0] || null;

      // Get last 12 months of bill instances for historical analysis
      const twelveMonthsAgo = toLocalDateString(new Date(year, month - 13, 1));

      const historicalInstances = await db
        .select()
        .from(billInstances)
        .where(
          and(
            eq(billInstances.billId, bill.id),
            gte(billInstances.dueDate, twelveMonthsAgo),
            lte(billInstances.dueDate, monthEnd)
          )
        )
        .orderBy(desc(billInstances.dueDate));

      // Filter to paid instances only for averages
      const paidInstances = historicalInstances.filter(i => i.status === 'paid');

      // Calculate historical averages
      const threeMonthAvg = calculateAverage(paidInstances.slice(0, 3));
      const sixMonthAvg = calculateAverage(paidInstances.slice(0, 6));
      const twelveMonthAvg = calculateAverage(paidInstances.slice(0, 12));
      const allTimeAvg = calculateAverage(paidInstances);

      // Calculate variance for current month (if paid)
      let variance: number | null = null;
      let variancePercent: number | null = null;

      if (currentInstance && currentInstance.actualAmount !== null) {
        variance = new Decimal(currentInstance.actualAmount)
          .minus(currentInstance.expectedAmount)
          .toDecimalPlaces(2)
          .toNumber();

        variancePercent = new Decimal(variance)
          .div(currentInstance.expectedAmount)
          .times(100)
          .toDecimalPlaces(1)
          .toNumber();
      }

      // Build monthly breakdown (last 12 months)
      const monthlyBreakdown = historicalInstances.map(instance => {
        const instanceDate = new Date(instance.dueDate);
        const instanceMonth = `${instanceDate.getFullYear()}-${String(
          instanceDate.getMonth() + 1
        ).padStart(2, '0')}`;

        let instanceVariance: number | null = null;
        if (instance.actualAmount !== null) {
          instanceVariance = new Decimal(instance.actualAmount)
            .minus(instance.expectedAmount)
            .toDecimalPlaces(2)
            .toNumber();
        }

        return {
          month: instanceMonth,
          expected: instance.expectedAmount,
          actual: instance.actualAmount,
          variance: instanceVariance,
          status: instance.status,
        };
      });

      // Calculate trend
      const trend = calculateTrend(historicalInstances);
      const recommendedBudget = calculateRecommendedBudget(
        paidInstances,
        trend.direction,
        bill.expectedAmount
      );

      // Build bill data object
      const billData: VariableBillData = {
        id: bill.id,
        name: bill.name,
        frequency: bill.frequency,
        expectedAmount: bill.expectedAmount,
        currentMonth: {
          month: monthStr,
          instanceId: currentInstance?.id || null,
          expectedAmount: currentInstance?.expectedAmount || bill.expectedAmount,
          actualAmount: currentInstance?.actualAmount || null,
          variance,
          variancePercent,
          status: currentInstance?.status || 'pending',
          dueDate: currentInstance?.dueDate || monthEnd,
          paidDate: currentInstance?.paidDate || null,
        },
        historicalAverages: {
          threeMonth: threeMonthAvg,
          sixMonth: sixMonthAvg,
          twelveMonth: twelveMonthAvg,
          allTime: allTimeAvg,
        },
        monthlyBreakdown,
        trend: {
          direction: trend.direction,
          percentChange: trend.percentChange,
          recommendedBudget,
        },
      };

      billsData.push(billData);

      // Update summary totals
      summaryTotalExpected = summaryTotalExpected.plus(
        currentInstance?.expectedAmount || bill.expectedAmount
      );

      if (currentInstance?.actualAmount !== null) {
        summaryTotalActual = summaryTotalActual.plus(currentInstance.actualAmount);
        summaryPaidCount++;
      } else {
        summaryPendingCount++;
      }
    }

    // Calculate summary statistics
    const summaryVariance = summaryTotalActual.minus(summaryTotalExpected);
    const summaryVariancePercent = summaryTotalExpected.gt(0)
      ? summaryVariance.div(summaryTotalExpected).times(100).toDecimalPlaces(1).toNumber()
      : 0;

    const summary: VariableBillSummary = {
      totalExpected: summaryTotalExpected.toDecimalPlaces(2).toNumber(),
      totalActual: summaryTotalActual.toDecimalPlaces(2).toNumber(),
      totalVariance: summaryVariance.toDecimalPlaces(2).toNumber(),
      variancePercent: summaryVariancePercent,
      billCount: variableBills.length,
      paidCount: summaryPaidCount,
      pendingCount: summaryPendingCount,
    };

    return Response.json({
      month: monthStr,
      summary,
      bills: billsData,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Variable bill tracking error:', error);
    return Response.json(
      { error: 'Failed to fetch variable bill data' },
      { status: 500 }
    );
  }
}
