/**
 * Credit Limit Change Notifications
 * 
 * Creates notifications when credit limits are changed on credit cards
 * or lines of credit. Shows the impact on utilization.
 * 
 * Part of Phase 10: Notifications for the Unified Architecture.
 */

import { db } from '@/lib/db';
import { notifications, userHouseholdPreferences, creditLimitHistory } from '@/lib/db/schema';
import { toLocalDateString } from '@/lib/utils/local-date';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

type ChangeSource = 'user_update' | 'bank_increase' | 'bank_decrease' | 'initial';

interface CreditLimitChangeInput {
  accountId: string;
  accountName: string;
  oldLimit: number;
  newLimit: number;
  changeSource: ChangeSource;
  currentBalance: number;
  userId: string;
  householdId: string;
}

interface CreditLimitChangeResult {
  notificationId: string | null;
  historyId: string;
  utilizationBefore: number;
  utilizationAfter: number;
}

/**
 * Calculate utilization percentage
 */
function calculateUtilization(balance: number, creditLimit: number): number {
  if (creditLimit <= 0) return 0;
  return new Decimal(Math.abs(balance)).div(creditLimit).times(100).toNumber();
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Get notification message based on limit change direction
 */
function getNotificationMessage(
  accountName: string,
  oldLimit: number,
  newLimit: number,
  utilizationBefore: number,
  utilizationAfter: number,
  changeSource: ChangeSource
): { title: string; message: string; priority: 'low' | 'normal' | 'high' | 'urgent' } {
  const isIncrease = newLimit > oldLimit;
  const changeAmount = Math.abs(newLimit - oldLimit);
  const _changePercent = oldLimit > 0 ? (changeAmount / oldLimit) * 100 : 0;

  if (isIncrease) {
    const sourceText = changeSource === 'bank_increase' 
      ? 'Your credit card issuer has increased' 
      : 'You increased';
    
    return {
      title: `Credit Limit Increased: ${accountName}`,
      message: `${sourceText} your credit limit from ${formatCurrency(oldLimit)} to ${formatCurrency(newLimit)} (+${formatCurrency(changeAmount)}). Your utilization improved from ${utilizationBefore.toFixed(0)}% to ${utilizationAfter.toFixed(0)}%.`,
      priority: 'low',
    };
  } else {
    const sourceText = changeSource === 'bank_decrease' 
      ? 'Your credit card issuer has decreased' 
      : 'You decreased';
    
    // Determine priority based on new utilization
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
    if (utilizationAfter >= 90) {
      priority = 'urgent';
    } else if (utilizationAfter >= 75) {
      priority = 'high';
    }

    let warningText = '';
    if (utilizationAfter >= 75) {
      warningText = ' Consider paying down this balance to improve your credit utilization.';
    }

    return {
      title: `Credit Limit Decreased: ${accountName}`,
      message: `${sourceText} your credit limit from ${formatCurrency(oldLimit)} to ${formatCurrency(newLimit)} (-${formatCurrency(changeAmount)}). Your utilization has changed from ${utilizationBefore.toFixed(0)}% to ${utilizationAfter.toFixed(0)}%.${warningText}`,
      priority,
    };
  }
}

/**
 * Record a credit limit change and create a notification if enabled
 */
export async function recordCreditLimitChange(
  input: CreditLimitChangeInput
): Promise<CreditLimitChangeResult> {
  const now = new Date();
  const nowString = now.toISOString();

  try {
    // Calculate utilization before and after
    const utilizationBefore = calculateUtilization(input.currentBalance, input.oldLimit);
    const utilizationAfter = calculateUtilization(input.currentBalance, input.newLimit);

    // Record the change in credit limit history
    const historyId = nanoid();
    await db.insert(creditLimitHistory).values({
      id: historyId,
      accountId: input.accountId,
      userId: input.userId,
      householdId: input.householdId,
      previousLimit: input.oldLimit,
      newLimit: input.newLimit,
      changeDate: toLocalDateString(now),
      changeReason: input.changeSource,
      utilizationBefore,
      utilizationAfter,
      createdAt: nowString,
    });

    // Check if notifications are enabled for this user/household
    const prefs = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, input.userId),
          eq(userHouseholdPreferences.householdId, input.householdId)
        )
      )
      .limit(1);

    // Skip notification if disabled or no preferences found
    if (prefs.length === 0 || !prefs[0].creditLimitChangeEnabled) {
      return {
        notificationId: null,
        historyId,
        utilizationBefore,
        utilizationAfter,
      };
    }

    // Skip notification for initial limit (account creation)
    if (input.changeSource === 'initial') {
      return {
        notificationId: null,
        historyId,
        utilizationBefore,
        utilizationAfter,
      };
    }

    // Get notification message
    const { title, message, priority } = getNotificationMessage(
      input.accountName,
      input.oldLimit,
      input.newLimit,
      utilizationBefore,
      utilizationAfter,
      input.changeSource
    );

    // Create notification
    const notificationId = nanoid();
    await db.insert(notifications).values({
      id: notificationId,
      userId: input.userId,
      householdId: input.householdId,
      type: 'system', // Using system type for credit limit changes
      title,
      message,
      priority,
      entityType: 'account',
      entityId: input.accountId,
      actionUrl: '/dashboard/accounts',
      actionLabel: 'View Account',
      isActionable: true,
      metadata: JSON.stringify({
        accountId: input.accountId,
        accountName: input.accountName,
        oldLimit: input.oldLimit,
        newLimit: input.newLimit,
        changeSource: input.changeSource,
        utilizationBefore,
        utilizationAfter,
        historyId,
        notificationType: 'credit_limit_change',
      }),
      isRead: false,
      createdAt: nowString,
    });

    return {
      notificationId,
      historyId,
      utilizationBefore,
      utilizationAfter,
    };
  } catch (error) {
    console.error('Error recording credit limit change:', error);
    throw error;
  }
}

/**
 * Get credit limit history for an account
 */
export async function getCreditLimitHistory(
  accountId: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  previousLimit: number;
  newLimit: number;
  changeDate: string;
  changeSource: ChangeSource;
  utilizationBefore: number | null;
  utilizationAfter: number | null;
}>> {
  try {
    const history = await db
      .select()
      .from(creditLimitHistory)
      .where(eq(creditLimitHistory.accountId, accountId))
      .orderBy(creditLimitHistory.changeDate)
      .limit(limit);

    return history.map((h) => ({
      id: h.id,
      previousLimit: h.previousLimit || 0,
      newLimit: h.newLimit,
      changeDate: h.changeDate,
      changeSource: h.changeReason as ChangeSource,
      utilizationBefore: h.utilizationBefore,
      utilizationAfter: h.utilizationAfter,
    }));
  } catch (error) {
    console.error('Error getting credit limit history:', error);
    return [];
  }
}

/**
 * Get summary of credit limit changes for a household
 */
export async function getCreditLimitChangeSummary(
  householdId: string,
  days: number = 30
): Promise<{
  totalIncreases: number;
  totalDecreases: number;
  netChange: number;
  changes: Array<{
    accountId: string;
    changeDate: string;
    amount: number;
    direction: 'increase' | 'decrease';
  }>;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const history = await db
      .select()
      .from(creditLimitHistory)
      .where(eq(creditLimitHistory.householdId, householdId));

    // Filter by date in memory (SQLite date comparison can be tricky)
    const recentChanges = history.filter(
      (h) => new Date(h.changeDate) >= cutoffDate && h.changeReason !== 'initial'
    );

    let totalIncreases = 0;
    let totalDecreases = 0;
    const changes: Array<{
      accountId: string;
      changeDate: string;
      amount: number;
      direction: 'increase' | 'decrease';
    }> = [];

    for (const change of recentChanges) {
      const diff = change.newLimit - (change.previousLimit || 0);
      if (diff > 0) {
        totalIncreases += diff;
        changes.push({
          accountId: change.accountId,
          changeDate: change.changeDate,
          amount: diff,
          direction: 'increase',
        });
      } else if (diff < 0) {
        totalDecreases += Math.abs(diff);
        changes.push({
          accountId: change.accountId,
          changeDate: change.changeDate,
          amount: Math.abs(diff),
          direction: 'decrease',
        });
      }
    }

    return {
      totalIncreases,
      totalDecreases,
      netChange: totalIncreases - totalDecreases,
      changes: changes.sort((a, b) => b.changeDate.localeCompare(a.changeDate)),
    };
  } catch (error) {
    console.error('Error getting credit limit change summary:', error);
    return {
      totalIncreases: 0,
      totalDecreases: 0,
      netChange: 0,
      changes: [],
    };
  }
}
