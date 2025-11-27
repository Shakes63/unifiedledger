import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, budgetCategories } from '@/lib/db/schema';
import { eq, and, gte, lte, sum } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface MonthlyBreakdown {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  savingsRate: number;
  budgetAdherence: number;
  categoriesOverBudget: number;
  categoriesOnTrack: number;
}

interface CategoryMonthlyData {
  month: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentOfBudget: number;
}

interface CategoryTrend {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  monthlyData: CategoryMonthlyData[];
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentChange: number;
    averageSpending: number;
    consistency: number;
  };
  insights: string[];
}

interface OverspendingCategory {
  categoryId: string;
  categoryName: string;
  averageOverage: number;
  monthsOverBudget: number;
  totalOverage: number;
  severity: 'critical' | 'high' | 'moderate';
}

interface Recommendation {
  type: 'budget_adjustment' | 'spending_alert' | 'savings_opportunity' | 'consistency_improvement';
  categoryId: string | null;
  priority: 'high' | 'medium' | 'low';
  message: string;
  suggestedAction: string;
  potentialSavings: number | null;
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(numbers: number[]): Decimal {
  if (numbers.length === 0) return new Decimal(0);

  const mean = numbers.reduce((sum, n) => sum.plus(n), new Decimal(0)).div(numbers.length);
  const squaredDiffs = numbers.map(n => new Decimal(n).minus(mean).pow(2));
  const variance = squaredDiffs.reduce((sum, d) => sum.plus(d), new Decimal(0)).div(numbers.length);

  return variance.sqrt(); // Return standard deviation
}

/**
 * Calculate budget adherence score for a month
 */
async function calculateBudgetAdherence(
  userId: string,
  householdId: string,
  monthStart: string,
  monthEnd: string
): Promise<{
  score: number;
  overBudgetCount: number;
  onTrackCount: number;
}> {
  // Get all active categories with budgets
  const categories = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId),
        eq(budgetCategories.isActive, true)
      )
    );

  const categoriesWithBudgets = categories.filter(c => c.monthlyBudget && c.monthlyBudget > 0);

  if (categoriesWithBudgets.length === 0) {
    return { score: 100, overBudgetCount: 0, onTrackCount: 0 };
  }

  let totalScore = 0;
  let overBudgetCount = 0;
  let onTrackCount = 0;

  for (const category of categoriesWithBudgets) {
    // Get actual spending for this category
    const spendingResult = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId),
          eq(transactions.categoryId, category.id),
          eq(transactions.type, category.type === 'income' ? 'income' : 'expense'),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd)
        )
      );

    const actualSpent = spendingResult[0]?.total ? new Decimal(spendingResult[0].total.toString()) : new Decimal(0);
    const budgeted = new Decimal(category.monthlyBudget!);

    if (actualSpent.lte(budgeted)) {
      // On or under budget
      totalScore += 100;
      onTrackCount++;
    } else {
      // Over budget
      overBudgetCount++;
      const overagePercent = actualSpent.minus(budgeted).div(budgeted).times(100);
      const score = Math.max(0, new Decimal(100).minus(overagePercent).toNumber());
      totalScore += score;
    }
  }

  const adherenceScore = Math.round(totalScore / categoriesWithBudgets.length);

  return {
    score: adherenceScore,
    overBudgetCount,
    onTrackCount,
  };
}

/**
 * GET /api/budgets/analyze
 *
 * Query Parameters:
 * - months: Number of months to analyze (default: 6, max: 12)
 * - endMonth: YYYY-MM format (default: current month)
 * - categoryId: Filter to specific category (optional)
 *
 * Returns comprehensive budget analytics data
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get query parameters
    const url = new URL(request.url);
    const monthsParam = url.searchParams.get('months');
    const endMonthParam = url.searchParams.get('endMonth');
    const categoryIdParam = url.searchParams.get('categoryId');

    // Parse and validate months parameter
    let monthCount = monthsParam ? parseInt(monthsParam) : 6;
    if (isNaN(monthCount) || monthCount < 1 || monthCount > 12) {
      monthCount = 6;
    }

    // Parse end month or default to current month
    let endYear: number;
    let endMonth: number;

    if (endMonthParam) {
      const [yearStr, monthStr] = endMonthParam.split('-');
      endYear = parseInt(yearStr);
      endMonth = parseInt(monthStr);
    } else {
      const now = new Date();
      endYear = now.getFullYear();
      endMonth = now.getMonth() + 1;
    }

    // Calculate start month
    const endDate = new Date(endYear, endMonth - 1, 1);
    const startDate = new Date(endYear, endMonth - monthCount, 1);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;

    const startMonthStr = `${startYear}-${String(startMonth).padStart(2, '0')}`;
    const endMonthStr = `${endYear}-${String(endMonth).padStart(2, '0')}`;

    // Generate array of months in period
    const monthsInPeriod: Array<{ year: number; month: number; str: string }> = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      monthsInPeriod.push({
        year,
        month,
        str: `${year}-${String(month).padStart(2, '0')}`,
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Calculate monthly breakdown
    const monthlyBreakdown: MonthlyBreakdown[] = [];
    let totalIncome = new Decimal(0);
    let totalExpenses = new Decimal(0);

    for (const monthData of monthsInPeriod) {
      const monthStart = `${monthData.str}-01`;
      const monthEnd = new Date(monthData.year, monthData.month, 0).toISOString().split('T')[0];

      // Get income for this month
      const incomeResult = await db
        .select({ total: sum(transactions.amount) })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId),
            eq(transactions.type, 'income'),
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd)
          )
        );

      // Get expenses for this month
      const expensesResult = await db
        .select({ total: sum(transactions.amount) })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId),
            eq(transactions.type, 'expense'),
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd)
          )
        );

      const monthIncome = incomeResult[0]?.total ? new Decimal(incomeResult[0].total.toString()) : new Decimal(0);
      const monthExpenses = expensesResult[0]?.total ? new Decimal(expensesResult[0].total.toString()) : new Decimal(0);
      const monthSavings = monthIncome.minus(monthExpenses);
      const monthSavingsRate = monthIncome.gt(0) ? monthSavings.div(monthIncome).times(100) : new Decimal(0);

      // Calculate budget adherence
      const adherence = await calculateBudgetAdherence(userId, householdId, monthStart, monthEnd);

      monthlyBreakdown.push({
        month: monthData.str,
        totalIncome: monthIncome.toDecimalPlaces(2).toNumber(),
        totalExpenses: monthExpenses.toDecimalPlaces(2).toNumber(),
        savings: monthSavings.toDecimalPlaces(2).toNumber(),
        savingsRate: monthSavingsRate.toDecimalPlaces(1).toNumber(),
        budgetAdherence: adherence.score,
        categoriesOverBudget: adherence.overBudgetCount,
        categoriesOnTrack: adherence.onTrackCount,
      });

      totalIncome = totalIncome.plus(monthIncome);
      totalExpenses = totalExpenses.plus(monthExpenses);
    }

    // Calculate summary statistics
    const totalSavings = totalIncome.minus(totalExpenses);
    const overallSavingsRate = totalIncome.gt(0) ? totalSavings.div(totalIncome).times(100) : new Decimal(0);
    const avgMonthlyIncome = totalIncome.div(monthCount);
    const avgMonthlyExpenses = totalExpenses.div(monthCount);
    const avgMonthlySavings = totalSavings.div(monthCount);
    const avgSavingsRate = totalIncome.gt(0) ? avgMonthlySavings.div(avgMonthlyIncome).times(100) : new Decimal(0);

    // Get all active categories
    const categories = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isActive, true)
        )
      );

    // Filter categories if categoryId specified
    const categoriesToAnalyze = categoryIdParam
      ? categories.filter(c => c.id === categoryIdParam)
      : categories.filter(c => c.monthlyBudget && c.monthlyBudget > 0);

    // Calculate category trends
    const categoryTrends: CategoryTrend[] = [];
    const overspendingCategories: OverspendingCategory[] = [];

    for (const category of categoriesToAnalyze) {
      const monthlyData: CategoryMonthlyData[] = [];

      for (const monthData of monthsInPeriod) {
        const monthStart = `${monthData.str}-01`;
        const monthEnd = new Date(monthData.year, monthData.month, 0).toISOString().split('T')[0];

        // Get actual spending
        const spendingResult = await db
          .select({ total: sum(transactions.amount) })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId),
              eq(transactions.categoryId, category.id),
              eq(transactions.type, category.type === 'income' ? 'income' : 'expense'),
              gte(transactions.date, monthStart),
              lte(transactions.date, monthEnd)
            )
          );

        const actual = spendingResult[0]?.total ? new Decimal(spendingResult[0].total.toString()) : new Decimal(0);
        const budgeted = new Decimal(category.monthlyBudget || 0);
        const variance = actual.minus(budgeted);
        const percentOfBudget = budgeted.gt(0) ? actual.div(budgeted).times(100) : new Decimal(0);

        monthlyData.push({
          month: monthData.str,
          budgeted: budgeted.toDecimalPlaces(2).toNumber(),
          actual: actual.toDecimalPlaces(2).toNumber(),
          variance: variance.toDecimalPlaces(2).toNumber(),
          percentOfBudget: percentOfBudget.toDecimalPlaces(1).toNumber(),
        });
      }

      // Calculate trend
      const actualSpending = monthlyData.map(m => m.actual);
      const avgSpending = actualSpending.reduce((sum, a) => sum.plus(a), new Decimal(0)).div(monthCount);

      // Compare first 2 months vs last 2 months
      const firstTwoAvg = monthlyData.length >= 2
        ? new Decimal(monthlyData[0].actual).plus(monthlyData[1].actual).div(2)
        : new Decimal(monthlyData[0]?.actual || 0);

      const lastTwoAvg = monthlyData.length >= 2
        ? new Decimal(monthlyData[monthlyData.length - 2].actual)
            .plus(monthlyData[monthlyData.length - 1].actual)
            .div(2)
        : new Decimal(monthlyData[monthlyData.length - 1]?.actual || 0);

      const percentChange = firstTwoAvg.gt(0)
        ? lastTwoAvg.minus(firstTwoAvg).div(firstTwoAvg).times(100)
        : new Decimal(0);

      let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (percentChange.gt(10)) {
        direction = 'increasing';
      } else if (percentChange.lt(-10)) {
        direction = 'decreasing';
      }

      // Calculate consistency (0-100, higher = more consistent)
      const stdDev = calculateVariance(actualSpending.map(a => a));
      const consistency = avgSpending.gt(0)
        ? new Decimal(100).minus(stdDev.div(avgSpending).times(100).clamp(0, 100))
        : new Decimal(100);

      // Generate insights
      const insights: string[] = [];
      if (direction === 'increasing') {
        insights.push(`Spending increased by ${Math.abs(percentChange.toNumber()).toFixed(1)}% over this period`);
      } else if (direction === 'decreasing') {
        insights.push(`Spending decreased by ${Math.abs(percentChange.toNumber()).toFixed(1)}% over this period`);
      }

      if (consistency.lt(70)) {
        insights.push('Spending is inconsistent - consider reviewing what causes fluctuations');
      } else if (consistency.gt(90)) {
        insights.push('Very consistent spending pattern');
      }

      // Check for overspending
      const monthsOver = monthlyData.filter(m => m.variance > 0).length;
      const totalOverage = monthlyData
        .filter(m => m.variance > 0)
        .reduce((sum, m) => sum.plus(m.variance), new Decimal(0));

      if (monthsOver > 0) {
        const avgOverage = totalOverage.div(monthsOver);
        const budgeted = new Decimal(category.monthlyBudget || 0);
        const overagePercent = budgeted.gt(0) ? avgOverage.div(budgeted).times(100) : new Decimal(0);

        let severity: 'critical' | 'high' | 'moderate' = 'moderate';
        if (overagePercent.gt(50)) {
          severity = 'critical';
        } else if (overagePercent.gt(20)) {
          severity = 'high';
        }

        overspendingCategories.push({
          categoryId: category.id,
          categoryName: category.name,
          averageOverage: avgOverage.toDecimalPlaces(2).toNumber(),
          monthsOverBudget: monthsOver,
          totalOverage: totalOverage.toDecimalPlaces(2).toNumber(),
          severity,
        });

        insights.push(`Over budget in ${monthsOver} out of ${monthCount} months`);
      }

      categoryTrends.push({
        categoryId: category.id,
        categoryName: category.name,
        categoryType: category.type,
        monthlyData,
        trend: {
          direction,
          percentChange: percentChange.toDecimalPlaces(1).toNumber(),
          averageSpending: avgSpending.toDecimalPlaces(2).toNumber(),
          consistency: consistency.toDecimalPlaces(0).toNumber(),
        },
        insights,
      });
    }

    // Sort overspending by total overage
    overspendingCategories.sort((a, b) => b.totalOverage - a.totalOverage);

    // Generate recommendations
    const recommendations: Recommendation[] = [];

    // Budget adjustment recommendations
    for (const category of categoryTrends) {
      const allUnder = category.monthlyData.every(m => m.variance < 0);
      const allOver = category.monthlyData.every(m => m.variance > 0);

      if (allUnder) {
        const avgVariance = category.monthlyData.reduce(
          (sum, m) => sum.plus(Math.abs(m.variance)),
          new Decimal(0)
        ).div(monthCount);

        recommendations.push({
          type: 'budget_adjustment',
          categoryId: category.categoryId,
          priority: 'medium',
          message: `${category.categoryName} is consistently under budget`,
          suggestedAction: `Consider reducing budget by $${avgVariance.toDecimalPlaces(0).toNumber()}`,
          potentialSavings: avgVariance.toDecimalPlaces(2).toNumber(),
        });
      } else if (allOver) {
        const avgVariance = category.monthlyData.reduce(
          (sum, m) => sum.plus(Math.abs(m.variance)),
          new Decimal(0)
        ).div(monthCount);

        recommendations.push({
          type: 'budget_adjustment',
          categoryId: category.categoryId,
          priority: 'high',
          message: `${category.categoryName} is consistently over budget`,
          suggestedAction: `Consider increasing budget by $${avgVariance.toDecimalPlaces(0).toNumber()} or reducing spending`,
          potentialSavings: null,
        });
      }
    }

    // Savings opportunity recommendations
    for (const category of categoryTrends) {
      if (category.trend.direction === 'decreasing' && category.trend.percentChange < -15) {
        recommendations.push({
          type: 'savings_opportunity',
          categoryId: category.categoryId,
          priority: 'medium',
          message: `${category.categoryName} spending is decreasing`,
          suggestedAction: 'Great job reducing costs in this category!',
          potentialSavings: null,
        });
      }
    }

    // Spending alert recommendations
    for (const category of categoryTrends) {
      if (category.trend.direction === 'increasing' && category.trend.percentChange > 25) {
        recommendations.push({
          type: 'spending_alert',
          categoryId: category.categoryId,
          priority: 'high',
          message: `${category.categoryName} spending increased by ${category.trend.percentChange.toFixed(0)}%`,
          suggestedAction: 'Review recent transactions to identify cause of increase',
          potentialSavings: null,
        });
      }
    }

    // Sort recommendations by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return Response.json({
      period: {
        startMonth: startMonthStr,
        endMonth: endMonthStr,
        monthCount,
      },
      summary: {
        averageMonthlyIncome: avgMonthlyIncome.toDecimalPlaces(2).toNumber(),
        averageMonthlyExpenses: avgMonthlyExpenses.toDecimalPlaces(2).toNumber(),
        averageMonthlySavings: avgMonthlySavings.toDecimalPlaces(2).toNumber(),
        averageSavingsRate: avgSavingsRate.toDecimalPlaces(1).toNumber(),
        totalIncome: totalIncome.toDecimalPlaces(2).toNumber(),
        totalExpenses: totalExpenses.toDecimalPlaces(2).toNumber(),
        totalSavings: totalSavings.toDecimalPlaces(2).toNumber(),
        overallSavingsRate: overallSavingsRate.toDecimalPlaces(1).toNumber(),
      },
      monthlyBreakdown,
      categoryTrends,
      overspendingRanking: overspendingCategories,
      recommendations,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Budget analytics error:', error);
    return Response.json(
      { error: 'Failed to fetch budget analytics' },
      { status: 500 }
    );
  }
}
