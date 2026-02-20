import { db } from '@/lib/db';
import { notificationPreferences, budgetCategories, transactions, notifications } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, ne } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications/notification-service';
import { getMonthRangeForDate, getTodayLocalDateString } from '@/lib/utils/local-date';
import Decimal from 'decimal.js';

/**
 * Check all budget categories for users and create notifications if thresholds are exceeded
 */
export async function checkAndCreateBudgetWarnings() {
  try {
    // Get all users with budget warnings enabled
    const usersWithBudgetWarnings = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.budgetWarningEnabled, true));

    let createdNotifications = 0;
    let checkedCategories = 0;

    for (const prefs of usersWithBudgetWarnings) {
      const userId = prefs.userId;

      // Get all active budget categories for this user
      const userBudgets = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.isActive, true),
            ne(budgetCategories.monthlyBudget, 0)
          )
        );

      for (const budget of userBudgets) {
        checkedCategories++;

        // Get current month's date range
        const now = new Date();
        const { startDate: monthStart, endDate: monthEnd } = getMonthRangeForDate(now);

        // Get spending for this month and category
        const spendingResult = await db
          .select({
            totalCents: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.categoryId, budget.id),
              eq(transactions.type, 'expense'),
              gte(transactions.date, monthStart),
              lte(transactions.date, monthEnd)
            )
          );

        const spent = new Decimal(spendingResult[0]?.totalCents ?? 0).div(100).toNumber();

        const monthlyBudget = budget.monthlyBudget || 0;
        if (monthlyBudget <= 0) continue;

        const percentage = (spent / monthlyBudget) * 100;
        const thresholdPercentage = prefs.budgetWarningThreshold ?? 80;

        // Check if we should create a notification
        let notificationCreated = false;

        // Check for budget exceeded
        if (prefs.budgetExceededAlert && percentage >= 100) {
          // Check if notification already exists for today
          const today = getTodayLocalDateString();
          const existingNotif = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, userId),
                eq(notifications.type, 'budget_exceeded'),
                eq(notifications.entityId, budget.id),
                gte(notifications.createdAt, today)
              )
            )
            .limit(1);

          if (existingNotif.length === 0) {
            const exceeded = Math.round(spent - monthlyBudget);
            await createNotification({
              userId,
              type: 'budget_exceeded',
              title: `${budget.name} budget exceeded`,
              message: `You've exceeded your ${budget.name} budget by $${exceeded.toFixed(
                2
              )}. Current spending: $${spent.toFixed(2)} of $${monthlyBudget.toFixed(2)}.`,
              priority: 'high',
              actionUrl: `/dashboard/transactions?category=${budget.id}`,
              actionLabel: 'View Transactions',
              isActionable: true,
              entityType: 'budgetCategory',
              entityId: budget.id,
              metadata: {
                categoryId: budget.id,
                categoryName: budget.name,
                spent,
                budget: monthlyBudget,
                percentage: Math.round(percentage),
                exceeded,
              },
            });
            notificationCreated = true;
          }
        }
        // Check for budget warning (at threshold percentage)
        else if (!notificationCreated && percentage >= thresholdPercentage) {
          // Check if notification already exists for today
          const today = getTodayLocalDateString();
          const existingNotif = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, userId),
                eq(notifications.type, 'budget_warning'),
                eq(notifications.entityId, budget.id),
                gte(notifications.createdAt, today)
              )
            )
            .limit(1);

          if (existingNotif.length === 0) {
            const remaining = Math.max(0, monthlyBudget - spent);
            await createNotification({
              userId,
              type: 'budget_warning',
              title: `${budget.name} budget at ${Math.round(percentage)}%`,
              message: `You're at ${Math.round(percentage)}% of your ${budget.name} budget. You've spent $${spent.toFixed(
                2
              )} of $${monthlyBudget.toFixed(2)}. $${remaining.toFixed(2)} remaining.`,
              priority: 'normal',
              actionUrl: `/dashboard/transactions?category=${budget.id}`,
              actionLabel: 'View Transactions',
              isActionable: true,
              entityType: 'budgetCategory',
              entityId: budget.id,
              metadata: {
                categoryId: budget.id,
                categoryName: budget.name,
                spent,
                budget: monthlyBudget,
                percentage: Math.round(percentage),
                remaining,
              },
            });
            notificationCreated = true;
          }
        }

        if (notificationCreated) {
          createdNotifications++;
        }
      }
    }

    return {
      success: true,
      notificationsCreated: createdNotifications,
      checkedCategories,
    };
  } catch (error) {
    console.error('Error checking budget warnings:', error);
    throw error;
  }
}
