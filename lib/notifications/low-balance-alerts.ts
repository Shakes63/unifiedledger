import { db } from '@/lib/db';
import { notificationPreferences, accounts, notifications } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications/notification-service';
import { getTodayLocalDateString } from '@/lib/utils/local-date';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';

/**
 * Check all user accounts for low balances and create notifications
 */
export async function checkAndCreateLowBalanceAlerts() {
  try {
    // Get all users with low balance alerts enabled
    const usersWithLowBalanceAlerts = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.lowBalanceAlertEnabled, true));

    let createdNotifications = 0;
    let checkedAccounts = 0;

    for (const prefs of usersWithLowBalanceAlerts) {
      const userId = prefs.userId;
      const lowBalanceThreshold = prefs.lowBalanceThreshold || 100.0;

      // Get all active accounts for this user
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.isActive, true)
          )
        );

      for (const account of userAccounts) {
        checkedAccounts++;

        const balance = new Decimal(
          account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0
        )
          .div(100)
          .toNumber();

        // Check if balance is below threshold
        if (balance < lowBalanceThreshold) {
          // Check if notification already exists for today
          const today = getTodayLocalDateString();
          const existingNotif = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, userId),
                eq(notifications.type, 'low_balance'),
                eq(notifications.entityId, account.id),
                gte(notifications.createdAt, today)
              )
            )
            .limit(1);

          if (existingNotif.length === 0) {
            const warningAmount = lowBalanceThreshold - balance;

            // Determine priority based on how low the balance is
            let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
            if (balance <= 0) {
              priority = 'urgent';
            } else if (balance < lowBalanceThreshold * 0.25) {
              priority = 'high';
            }

            await createNotification({
              userId,
              type: 'low_balance',
              title: `Low balance alert: ${account.name}`,
              message: `Your ${account.name} account balance is $${balance.toFixed(
                2
              )}, which is below your alert threshold of $${lowBalanceThreshold.toFixed(
                2
              )}. Add $${warningAmount.toFixed(2)} to reach your threshold.`,
              priority,
              actionUrl: `/dashboard/transactions?account=${account.id}`,
              actionLabel: 'View Account',
              isActionable: true,
              entityType: 'account',
              entityId: account.id,
              metadata: {
                accountId: account.id,
                accountName: account.name,
                currentBalance: balance,
                threshold: lowBalanceThreshold,
                deficit: Math.round(warningAmount * 100) / 100,
              },
            });

            createdNotifications++;
          }
        }
      }
    }

    return {
      success: true,
      notificationsCreated: createdNotifications,
      checkedAccounts,
    };
  } catch (error) {
    console.error('Error checking low balance alerts:', error);
    throw error;
  }
}
