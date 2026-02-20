/**
 * High Utilization Alerts
 * 
 * Monitors credit card/line of credit utilization and creates notifications
 * when utilization crosses configurable thresholds (30%, 50%, 75%, 90%).
 * 
 * Part of Phase 10: Notifications for the Unified Architecture.
 */

import { db } from '@/lib/db';
import { accounts, utilizationAlertState, userHouseholdPreferences, notifications } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';

// Utilization thresholds with severity levels
interface UtilizationThreshold {
  percentage: number;
  field: 'threshold30Notified' | 'threshold50Notified' | 'threshold75Notified' | 'threshold90Notified';
  severity: 'info' | 'warning' | 'high' | 'urgent';
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

const THRESHOLDS: UtilizationThreshold[] = [
  { percentage: 30, field: 'threshold30Notified', severity: 'info', priority: 'low' },
  { percentage: 50, field: 'threshold50Notified', severity: 'warning', priority: 'normal' },
  { percentage: 75, field: 'threshold75Notified', severity: 'high', priority: 'high' },
  { percentage: 90, field: 'threshold90Notified', severity: 'urgent', priority: 'urgent' },
];

interface UtilizationAlertResult {
  accountId: string;
  accountName: string;
  utilization: number;
  threshold: number;
  notificationId: string;
}

/**
 * Calculate utilization percentage for an account
 */
function calculateUtilization(balance: number, creditLimit: number | null): number {
  if (!creditLimit || creditLimit <= 0) return 0;
  // Credit cards typically have negative balance representing debt owed
  // But we store as positive for credit accounts
  const absBalance = Math.abs(balance);
  return new Decimal(absBalance).div(creditLimit).times(100).toNumber();
}

/**
 * Get notification message based on severity
 */
function getNotificationMessage(
  accountName: string,
  utilization: number,
  threshold: number,
  balance: number,
  creditLimit: number,
  severity: string
): { title: string; message: string } {
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(balance));
  
  const formattedLimit = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(creditLimit);

  switch (severity) {
    case 'urgent':
      return {
        title: `Critical Credit Utilization: ${accountName}`,
        message: `Your credit utilization has reached ${utilization.toFixed(0)}%! High utilization can impact your credit score. Balance: ${formattedBalance} / ${formattedLimit} limit.`,
      };
    case 'high':
      return {
        title: `High Credit Utilization: ${accountName}`,
        message: `Your credit utilization on ${accountName} has reached ${utilization.toFixed(0)}%, exceeding your ${threshold}% alert threshold. Balance: ${formattedBalance} / ${formattedLimit} limit.`,
      };
    case 'warning':
      return {
        title: `Credit Utilization Warning: ${accountName}`,
        message: `Your credit utilization on ${accountName} is at ${utilization.toFixed(0)}%. Consider paying down the balance to stay below ${threshold}%. Balance: ${formattedBalance} / ${formattedLimit} limit.`,
      };
    default:
      return {
        title: `Credit Utilization Notice: ${accountName}`,
        message: `Your credit utilization on ${accountName} has reached ${utilization.toFixed(0)}%. Balance: ${formattedBalance} / ${formattedLimit} limit.`,
      };
  }
}

/**
 * Check and create utilization alerts for a specific user in a household
 */
export async function checkAndCreateUtilizationAlerts(
  userId: string,
  householdId: string
): Promise<UtilizationAlertResult[]> {
  const results: UtilizationAlertResult[] = [];
  const now = new Date().toISOString();

  try {
    // Get user's notification preferences for this household
    const prefs = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    // Check if utilization alerts are enabled
    if (prefs.length === 0 || !prefs[0].highUtilizationEnabled) {
      return results;
    }

    const threshold = prefs[0].highUtilizationThreshold || 75;

    // Get all active credit accounts for the household
    const creditAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        currentBalance: accounts.currentBalance,
        currentBalanceCents: accounts.currentBalanceCents,
        creditLimit: accounts.creditLimit,
        creditLimitCents: accounts.creditLimitCents,
        userId: accounts.userId,
        householdId: accounts.householdId,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          inArray(accounts.type, ['credit', 'line_of_credit']),
          eq(accounts.isActive, true)
        )
      );

    if (creditAccounts.length === 0) {
      return results;
    }

    // Process each credit account
    for (const account of creditAccounts) {
      const balance = new Decimal(
        account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0
      )
        .div(100)
        .toNumber();
      const limit = new Decimal(
        account.creditLimitCents ?? toMoneyCents(account.creditLimit) ?? 0
      )
        .div(100)
        .toNumber();
      const utilization = calculateUtilization(
        balance,
        limit
      );

      // Get or create alert state for this account
      let alertState = await db
        .select()
        .from(utilizationAlertState)
        .where(
          and(
            eq(utilizationAlertState.accountId, account.id),
            eq(utilizationAlertState.userId, userId)
          )
        )
        .limit(1);

      if (alertState.length === 0) {
        // Create new alert state
        const stateId = nanoid();
        await db.insert(utilizationAlertState).values({
          id: stateId,
          accountId: account.id,
          userId,
          householdId,
          lastUtilization: utilization,
          lastCheckedAt: now,
        });
        alertState = await db
          .select()
          .from(utilizationAlertState)
          .where(eq(utilizationAlertState.id, stateId))
          .limit(1);
      }

      const state = alertState[0];
      const previousUtilization = state.lastUtilization || 0;

      // Find thresholds that need to be checked
      const applicableThresholds = THRESHOLDS.filter(t => t.percentage <= threshold);

      // Check each threshold
      for (const thresh of applicableThresholds) {
        const wasNotified = state[thresh.field];
        const nowAbove = utilization >= thresh.percentage;
        const wasAbove = previousUtilization >= thresh.percentage;

        // Send notification if:
        // 1. Currently above threshold AND
        // 2. Haven't already notified for this threshold AND
        // 3. Either just crossed the threshold OR first time checking above threshold
        if (nowAbove && !wasNotified && (!wasAbove || previousUtilization === 0)) {
          const { title, message } = getNotificationMessage(
            account.name,
            utilization,
            thresh.percentage,
            balance,
            limit,
            thresh.severity
          );

          // Create notification
          const notificationId = nanoid();
          await db.insert(notifications).values({
            id: notificationId,
            userId,
            householdId,
            type: 'low_balance', // Reusing existing type for now - utilization is similar concept
            title,
            message,
            priority: thresh.priority,
            entityType: 'account',
            entityId: account.id,
            actionUrl: '/dashboard/accounts',
            actionLabel: 'View Account',
            isActionable: true,
            metadata: JSON.stringify({
              accountId: account.id,
              accountName: account.name,
              utilization,
              threshold: thresh.percentage,
              creditLimit: limit,
              balance,
              notificationType: 'high_utilization',
            }),
            isRead: false,
            createdAt: now,
          });

          // Mark threshold as notified
          await db
            .update(utilizationAlertState)
            .set({
              [thresh.field]: true,
              lastUtilization: utilization,
              lastCheckedAt: now,
              updatedAt: now,
            })
            .where(eq(utilizationAlertState.id, state.id));

          results.push({
            accountId: account.id,
            accountName: account.name,
            utilization,
            threshold: thresh.percentage,
            notificationId,
          });
        }

        // Reset notification flag if utilization drops below threshold
        if (!nowAbove && wasNotified) {
          await db
            .update(utilizationAlertState)
            .set({
              [thresh.field]: false,
              lastUtilization: utilization,
              lastCheckedAt: now,
              updatedAt: now,
            })
            .where(eq(utilizationAlertState.id, state.id));
        }
      }

      // Always update last utilization
      await db
        .update(utilizationAlertState)
        .set({
          lastUtilization: utilization,
          lastCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(utilizationAlertState.id, state.id));
    }

    return results;
  } catch (error) {
    console.error('Error checking utilization alerts:', error);
    return results;
  }
}

/**
 * Check utilization for all users in a household
 */
export async function checkHouseholdUtilizationAlerts(
  householdId: string
): Promise<UtilizationAlertResult[]> {
  const allResults: UtilizationAlertResult[] = [];

  try {
    // Get all users with preferences for this household
    const householdPrefs = await db
      .select({ userId: userHouseholdPreferences.userId })
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.householdId, householdId),
          eq(userHouseholdPreferences.highUtilizationEnabled, true)
        )
      );

    for (const pref of householdPrefs) {
      const results = await checkAndCreateUtilizationAlerts(pref.userId, householdId);
      allResults.push(...results);
    }

    return allResults;
  } catch (error) {
    console.error('Error checking household utilization alerts:', error);
    return allResults;
  }
}

/**
 * Get current utilization status for all credit accounts
 * Useful for displaying in UI
 */
export async function getUtilizationStatus(
  householdId: string
): Promise<Array<{
  accountId: string;
  accountName: string;
  balance: number;
  creditLimit: number;
  utilization: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}>> {
  try {
    const creditAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        currentBalance: accounts.currentBalance,
        currentBalanceCents: accounts.currentBalanceCents,
        creditLimit: accounts.creditLimit,
        creditLimitCents: accounts.creditLimitCents,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          inArray(accounts.type, ['credit', 'line_of_credit']),
          eq(accounts.isActive, true)
        )
      );

    return creditAccounts.map((account) => {
      const balance = new Decimal(
        account.currentBalanceCents ?? toMoneyCents(account.currentBalance) ?? 0
      )
        .div(100)
        .abs()
        .toNumber();
      const limit = new Decimal(
        account.creditLimitCents ?? toMoneyCents(account.creditLimit) ?? 0
      )
        .div(100)
        .toNumber();
      const utilization = calculateUtilization(balance, limit);

      let status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
      if (utilization < 10) {
        status = 'excellent';
      } else if (utilization < 30) {
        status = 'good';
      } else if (utilization < 50) {
        status = 'fair';
      } else if (utilization < 75) {
        status = 'poor';
      } else {
        status = 'critical';
      }

      return {
        accountId: account.id,
        accountName: account.name,
        balance,
        creditLimit: limit,
        utilization,
        status,
      };
    });
  } catch (error) {
    console.error('Error getting utilization status:', error);
    return [];
  }
}
