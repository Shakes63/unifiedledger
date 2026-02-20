import { db } from '@/lib/db';
import { budgetCategories, transactions } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { createNotification, getOrCreatePreferences } from './notification-service';
import { getLocalMonthString, getMonthRangeForYearMonth } from '@/lib/utils/local-date';
import Decimal from 'decimal.js';

interface BudgetReviewMetrics {
  adherenceScore: number;
  totalBudgeted: number;
  totalActual: number;
  savingsRate: number;
  topOverspending: Array<{ category: string; amount: number; percentage: number }>;
  topUnderspending: Array<{ category: string; amount: number; percentage: number }>;
  performanceLevel: 'excellent' | 'good' | 'needs_improvement';
  recommendations: string[];
}

interface CategoryBudgetStatus {
  id: string;
  name: string;
  type: string;
  monthlyBudget: number;
  actualSpent: number;
  remaining: number;
  percentage: number;
  status: 'on_track' | 'warning' | 'exceeded' | 'unbudgeted';
}

/**
 * Calculate budget adherence score for a month
 * Score is 0-100 based on how well the user stayed within budgets
 */
function calculateAdherenceScore(categories: CategoryBudgetStatus[]): number {
  if (categories.length === 0) return 100;

  let totalScore = 0;

  for (const category of categories) {
    const { monthlyBudget, actualSpent } = category;

    if (monthlyBudget === 0) continue; // Skip unbudgeted categories

    if (actualSpent <= monthlyBudget) {
      // Under or on budget = 100 points
      totalScore += 100;
    } else {
      // Over budget = penalize based on overage
      const overage = ((actualSpent - monthlyBudget) / monthlyBudget) * 100;
      const score = Math.max(0, 100 - overage);
      totalScore += score;
    }
  }

  const adherenceScore = totalScore / categories.length;
  return Math.round(adherenceScore);
}

/**
 * Get performance level based on adherence score
 */
function getPerformanceLevel(score: number): 'excellent' | 'good' | 'needs_improvement' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  return 'needs_improvement';
}

/**
 * Generate insights and recommendations based on budget performance
 */
function generateRecommendations(
  metrics: Omit<BudgetReviewMetrics, 'recommendations'>
): string[] {
  const recommendations: string[] = [];

  if (metrics.performanceLevel === 'excellent') {
    recommendations.push(
      `Great job! You stayed within budget in most categories.`
    );
    if (metrics.savingsRate > 0) {
      recommendations.push(
        `You saved ${metrics.savingsRate.toFixed(1)}% of your income this month.`
      );
    }
  } else if (metrics.performanceLevel === 'good') {
    if (metrics.topOverspending.length > 0) {
      const topCategory = metrics.topOverspending[0];
      recommendations.push(
        `Consider adjusting your budget for ${topCategory.category} (${topCategory.percentage.toFixed(0)}% over).`
      );
    }
    recommendations.push(
      `Small improvements in a few categories could boost your score.`
    );
  } else {
    // needs_improvement
    if (metrics.topOverspending.length > 0) {
      const categories = metrics.topOverspending.slice(0, 3).map(c => c.category).join(', ');
      recommendations.push(
        `Review your spending in: ${categories}.`
      );
    }
    recommendations.push(
      `Consider increasing budgets or reducing spending in key areas.`
    );
  }

  // Add positive notes about underspending
  if (metrics.topUnderspending.length > 0 && metrics.performanceLevel !== 'excellent') {
    const topCategory = metrics.topUnderspending[0];
    if (topCategory.amount > 50) {
      recommendations.push(
        `You saved $${topCategory.amount.toFixed(2)} in ${topCategory.category}!`
      );
    }
  }

  return recommendations;
}

/**
 * Get budget overview for a specific month
 */
async function getBudgetOverviewForMonth(
  userId: string,
  year: number,
  month: number
): Promise<CategoryBudgetStatus[]> {
  // Get month boundaries
  const { startDate: monthStart, endDate: monthEnd } = getMonthRangeForYearMonth(year, month);

  // Get all budget categories for this user
  const categories = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.isActive, true)
      )
    );

  const categoryStatuses: CategoryBudgetStatus[] = [];

  for (const category of categories) {
    // Calculate actual spending from transactions
    const categoryTransactions = await db
      .select({
        totalCents: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.categoryId, category.id),
          eq(transactions.type, 'expense'),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd)
        )
      );

    const actualSpent = new Decimal(categoryTransactions[0]?.totalCents ?? 0)
      .abs()
      .div(100)
      .toNumber();

    const monthlyBudget = category.monthlyBudget || 0;
    const remaining = monthlyBudget - actualSpent;
    const percentage = monthlyBudget > 0 ? (actualSpent / monthlyBudget) * 100 : 0;

    let status: 'on_track' | 'warning' | 'exceeded' | 'unbudgeted' = 'on_track';
    if (monthlyBudget === 0) {
      status = 'unbudgeted';
    } else if (percentage >= 100) {
      status = 'exceeded';
    } else if (percentage >= 80) {
      status = 'warning';
    }

    categoryStatuses.push({
      id: category.id,
      name: category.name,
      type: category.type,
      monthlyBudget,
      actualSpent,
      remaining,
      percentage,
      status,
    });
  }

  return categoryStatuses;
}

/**
 * Calculate budget review metrics for a month
 */
async function calculateBudgetMetrics(
  userId: string,
  month: string
): Promise<BudgetReviewMetrics> {
  const [year, monthNum] = month.split('-').map(Number);

  // Get budget overview
  const categories = await getBudgetOverviewForMonth(userId, year, monthNum);

  // Filter out unbudgeted categories for calculations
  const budgetedCategories = categories.filter(c => c.monthlyBudget > 0);

  // Calculate adherence score
  const adherenceScore = calculateAdherenceScore(budgetedCategories);

  // Calculate totals
  const totalBudgeted = budgetedCategories.reduce(
    (sum, c) => sum + c.monthlyBudget,
    0
  );
  const totalActual = budgetedCategories.reduce(
    (sum, c) => sum + c.actualSpent,
    0
  );

  // Calculate savings rate (simplified - based on expense budget vs actual)
  const savingsAmount = totalBudgeted - totalActual;
  const savingsRate = totalBudgeted > 0 ? (savingsAmount / totalBudgeted) * 100 : 0;

  // Find top overspending categories
  const overspendingCategories = budgetedCategories
    .filter(c => c.actualSpent > c.monthlyBudget)
    .map(c => ({
      category: c.name,
      amount: c.actualSpent - c.monthlyBudget,
      percentage: ((c.actualSpent - c.monthlyBudget) / c.monthlyBudget) * 100,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Find top underspending categories (savings opportunities)
  const underspendingCategories = budgetedCategories
    .filter(c => c.actualSpent < c.monthlyBudget)
    .map(c => ({
      category: c.name,
      amount: c.monthlyBudget - c.actualSpent,
      percentage: ((c.monthlyBudget - c.actualSpent) / c.monthlyBudget) * 100,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const performanceLevel = getPerformanceLevel(adherenceScore);

  const metricsWithoutRecommendations = {
    adherenceScore,
    totalBudgeted,
    totalActual,
    savingsRate,
    topOverspending: overspendingCategories,
    topUnderspending: underspendingCategories,
    performanceLevel,
  };

  const recommendations = generateRecommendations(metricsWithoutRecommendations);

  return {
    ...metricsWithoutRecommendations,
    recommendations,
  };
}

/**
 * Format notification message for budget review
 */
function formatNotificationMessage(month: string, metrics: BudgetReviewMetrics): string {
  const monthName = new Date(month + '-01').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  let message = `Your budget performance for ${monthName}:\n\n`;
  message += `📊 Adherence Score: ${metrics.adherenceScore}/100 (${metrics.performanceLevel})\n`;
  message += `💰 Total Budgeted: $${metrics.totalBudgeted.toFixed(2)}\n`;
  message += `💸 Total Spent: $${metrics.totalActual.toFixed(2)}\n`;

  if (metrics.savingsRate > 0) {
    message += `💚 Savings Rate: ${metrics.savingsRate.toFixed(1)}%\n`;
  }

  if (metrics.topOverspending.length > 0) {
    message += `\n⚠️ Top Overspending:\n`;
    metrics.topOverspending.forEach((item, index) => {
      message += `${index + 1}. ${item.category}: +$${item.amount.toFixed(2)} (${item.percentage.toFixed(0)}% over)\n`;
    });
  }

  if (metrics.recommendations.length > 0) {
    message += `\n💡 Recommendations:\n`;
    metrics.recommendations.forEach((rec) => {
      message += `• ${rec}\n`;
    });
  }

  return message.trim();
}

/**
 * Generate and send monthly budget review notification for a user
 */
export async function generateMonthlyBudgetReview(
  userId: string,
  month: string
): Promise<string | null> {
  try {
    // Check if user has budget review notifications enabled
    const prefs = await getOrCreatePreferences(userId);
    if (!prefs.budgetReviewEnabled) {
      console.log(`Budget review disabled for user ${userId}`);
      return null;
    }

    // Calculate metrics
    const metrics = await calculateBudgetMetrics(userId, month);

    // Skip if no budgets were set
    if (metrics.totalBudgeted === 0) {
      console.log(`No budgets set for user ${userId} in ${month}`);
      return null;
    }

    // Format notification
    const monthName = new Date(month + '-01').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const title = `${monthName} Budget Review`;
    const message = formatNotificationMessage(month, metrics);

    // Create notification
    const notificationId = await createNotification({
      userId,
      type: 'budget_review',
      title,
      message,
      priority: 'normal',
      actionUrl: '/dashboard/budgets',
      actionLabel: 'View Budget Dashboard',
      isActionable: true,
      metadata: {
        month,
        adherenceScore: metrics.adherenceScore,
        performanceLevel: metrics.performanceLevel,
        totalBudgeted: metrics.totalBudgeted,
        totalActual: metrics.totalActual,
        savingsRate: metrics.savingsRate,
      },
    });

    console.log(`Budget review notification created for user ${userId}: ${notificationId}`);
    return notificationId;
  } catch (error) {
    console.error(`Error generating budget review for user ${userId}:`, error);
    return null;
  }
}

/**
 * Send budget review notifications to all active users
 * This should be called at the end of each month via cron job
 */
export async function sendBudgetReviewNotifications(): Promise<number> {
  try {
    // Get the previous month (since this runs at the end of the month)
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = getLocalMonthString(lastMonth); // YYYY-MM format

    console.log(`Sending budget review notifications for ${month}...`);

    // Get all unique user IDs from budget categories
    const categories = await db
      .select({ userId: budgetCategories.userId })
      .from(budgetCategories)
      .where(eq(budgetCategories.isActive, true));

    // Get unique user IDs
    const uniqueUserIds = [...new Set(categories.map(c => c.userId))];

    let sentCount = 0;

    for (const userId of uniqueUserIds) {
      const notificationId = await generateMonthlyBudgetReview(userId, month);
      if (notificationId) {
        sentCount++;
      }
    }

    console.log(`Sent ${sentCount} budget review notifications for ${month}`);
    return sentCount;
  } catch (error) {
    console.error('Error sending budget review notifications:', error);
    return 0;
  }
}

/**
 * Cron job handler for monthly budget reviews
 * Run this on the last day of each month at 8 PM UTC
 * Cron expression: 0 20 28-31 * *
 */
export async function runMonthlyBudgetReviewCron(): Promise<void> {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if tomorrow is a new month (meaning today is last day of month)
    if (tomorrow.getMonth() !== today.getMonth()) {
      console.log('Last day of month detected - sending budget review notifications');
      await sendBudgetReviewNotifications();
    } else {
      console.log('Not the last day of month - skipping budget review notifications');
    }
  } catch (error) {
    console.error('Error in monthly budget review cron:', error);
  }
}
