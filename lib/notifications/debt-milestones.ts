/**
 * Debt Milestones - Unified Architecture
 * 
 * Creates notifications for debt payoff milestones across all debt types:
 * - Credit accounts (credit cards, lines of credit)
 * - Debt-enabled bill schedules
 * 
 * Part of Phase 10: Notifications for the Unified Architecture.
 */

import { db } from '@/lib/db';
import { 
  accounts, 
  billTemplates, 
  billMilestones, 
  notifications, 
  userHouseholdPreferences,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';

// Milestone percentages to track
const MILESTONE_PERCENTAGES = [25, 50, 75, 100] as const;

interface UnifiedDebt {
  id: string;
  name: string;
  source: 'account' | 'bill';
  balance: number;
  originalBalance: number;
  userId: string;
  householdId: string;
}

interface MilestoneResult {
  debtId: string;
  debtName: string;
  source: 'account' | 'bill';
  percentage: number;
  notificationId: string;
}

/**
 * Get unified debt data for milestone calculations
 */
async function getUnifiedDebts(householdId: string): Promise<UnifiedDebt[]> {
  const unifiedDebts: UnifiedDebt[] = [];

  // Get credit accounts with balances
  const creditAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.householdId, householdId),
        inArray(accounts.type, ['credit', 'line_of_credit']),
        eq(accounts.isActive, true)
      )
    );

  for (const acc of creditAccounts) {
    const balance = new Decimal(
      acc.currentBalanceCents ?? toMoneyCents(acc.currentBalance) ?? 0
    )
      .div(100)
      .abs()
      .toNumber();
    // For credit accounts, original balance is the credit limit (max borrowed)
    // Milestone progress: going from credit limit to 0 balance
    const originalBalance = new Decimal(
      acc.creditLimitCents ?? toMoneyCents(acc.creditLimit ?? balance) ?? 0
    )
      .div(100)
      .toNumber();
    
    // Only include if there's debt to pay off
    if (balance > 0 || originalBalance > 0) {
      unifiedDebts.push({
        id: acc.id,
        name: acc.name,
        source: 'account',
        balance,
        originalBalance,
        userId: acc.userId,
        householdId: acc.householdId,
      });
    }
  }

  // Get debt-enabled bill schedules
  const debtBills = await db
    .select()
    .from(billTemplates)
    .where(
      and(
        eq(billTemplates.householdId, householdId),
        eq(billTemplates.debtEnabled, true),
        eq(billTemplates.isActive, true)
      )
    );

  for (const bill of debtBills) {
    const balance = bill.debtRemainingBalanceCents
      ? new Decimal(bill.debtRemainingBalanceCents).div(100).toNumber()
      : 0;
    const originalBalance = bill.debtOriginalBalanceCents
      ? new Decimal(bill.debtOriginalBalanceCents).div(100).toNumber()
      : balance;
    
    if (balance > 0 || originalBalance > 0) {
      unifiedDebts.push({
        id: bill.id,
        name: bill.name,
        source: 'bill',
        balance,
        originalBalance,
        userId: bill.createdByUserId,
        householdId: bill.householdId,
      });
    }
  }

  return unifiedDebts;
}

/**
 * Calculate milestone balance for a given percentage
 * E.g., 25% milestone = 75% of original balance remaining
 */
function calculateMilestoneBalance(originalBalance: number, percentage: number): number {
  const remainingPercentage = 100 - percentage;
  return new Decimal(originalBalance).times(remainingPercentage).div(100).toNumber();
}

/**
 * Check if a milestone has been achieved
 */
function isMilestoneAchieved(currentBalance: number, milestoneBalance: number): boolean {
  return currentBalance <= milestoneBalance;
}

/**
 * Get notification message for milestone
 */
function getMilestoneMessage(
  debtName: string,
  percentage: number,
  originalBalance: number,
  currentBalance: number,
  source: 'account' | 'bill'
): { title: string; message: string } {
  const formattedOriginal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(originalBalance);

  const formattedCurrent = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(currentBalance);

  const paidOff = new Decimal(originalBalance).minus(currentBalance).toNumber();
  const formattedPaidOff = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(paidOff);

  const debtType = source === 'account' ? 'credit card' : 'loan';

  if (percentage === 100) {
    return {
      title: `Debt Paid Off: ${debtName}`,
      message: `Congratulations! You've completely paid off your ${debtName} ${debtType}! Total paid: ${formattedOriginal}. Amazing work!`,
    };
  }

  return {
    title: `Debt Milestone: ${percentage}% Paid Off!`,
    message: `You've paid off ${percentage}% of your ${debtName} ${debtType}! Paid: ${formattedPaidOff} of ${formattedOriginal}. Remaining: ${formattedCurrent}. Keep going!`,
  };
}

/**
 * Ensure milestones exist for a unified debt
 */
async function ensureMilestonesExist(debt: UnifiedDebt): Promise<void> {
  const existingMilestones = await db
    .select()
    .from(billMilestones)
    .where(
      debt.source === 'account'
        ? eq(billMilestones.accountId, debt.id)
        : eq(billMilestones.billId, debt.id)
    );

  const existingPercentages = new Set(existingMilestones.map(m => m.percentage));

  for (const percentage of MILESTONE_PERCENTAGES) {
    if (!existingPercentages.has(percentage)) {
      const milestoneBalance = calculateMilestoneBalance(debt.originalBalance, percentage);
      await db.insert(billMilestones).values({
        id: nanoid(),
        billId: debt.source === 'bill' ? debt.id : null,
        accountId: debt.source === 'account' ? debt.id : null,
        userId: debt.userId,
        householdId: debt.householdId,
        percentage,
        milestoneBalance,
      });
    }
  }
}

/**
 * Check and create debt payoff milestone notifications for a household
 */
export async function checkAndCreateUnifiedDebtMilestoneNotifications(
  householdId: string
): Promise<MilestoneResult[]> {
  const results: MilestoneResult[] = [];
  const now = new Date().toISOString();

  try {
    // Get all unified debts
    const unifiedDebts = await getUnifiedDebts(householdId);

    // Get users who have milestone notifications enabled
    const usersWithNotifications = await db
      .select({ userId: userHouseholdPreferences.userId })
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.householdId, householdId),
          eq(userHouseholdPreferences.debtMilestonesEnabled, true)
        )
      );

    const notifyUserIds = new Set(usersWithNotifications.map(u => u.userId));

    for (const debt of unifiedDebts) {
      // Ensure milestones exist
      await ensureMilestonesExist(debt);

      // Get milestones for this debt
      const milestones = await db
        .select()
        .from(billMilestones)
        .where(
          debt.source === 'account'
            ? eq(billMilestones.accountId, debt.id)
            : eq(billMilestones.billId, debt.id)
        );

      // Check each milestone
      for (const milestone of milestones) {
        const isAchieved = isMilestoneAchieved(debt.balance, milestone.milestoneBalance);
        const wasAchieved = !!milestone.achievedAt;
        const notificationSent = !!milestone.notificationSentAt;

        // Mark as achieved if newly achieved
        if (isAchieved && !wasAchieved) {
          await db
            .update(billMilestones)
            .set({ achievedAt: now })
            .where(eq(billMilestones.id, milestone.id));
        }

        // Create notification if achieved and not already notified
        if (isAchieved && !notificationSent && notifyUserIds.has(debt.userId)) {
          const { title, message } = getMilestoneMessage(
            debt.name,
            milestone.percentage,
            debt.originalBalance,
            debt.balance,
            debt.source
          );

          const notificationId = nanoid();
          await db.insert(notifications).values({
            id: notificationId,
            userId: debt.userId,
            householdId: debt.householdId,
            type: 'debt_milestone',
            title,
            message,
            priority: milestone.percentage === 100 ? 'urgent' : 'high',
            entityType: debt.source === 'account' ? 'account' : 'bill',
            entityId: debt.id,
            actionUrl: '/dashboard/debts',
            actionLabel: 'View Debts',
            isActionable: true,
            metadata: JSON.stringify({
              debtId: debt.id,
              debtName: debt.name,
              source: debt.source,
              percentage: milestone.percentage,
              milestoneBalance: milestone.milestoneBalance,
              remainingBalance: debt.balance,
              originalBalance: debt.originalBalance,
              notificationType: 'debt_payoff_milestone',
            }),
            isRead: false,
            createdAt: now,
          });

          // Mark notification as sent
          await db
            .update(billMilestones)
            .set({ notificationSentAt: now })
            .where(eq(billMilestones.id, milestone.id));

          results.push({
            debtId: debt.id,
            debtName: debt.name,
            source: debt.source,
            percentage: milestone.percentage,
            notificationId,
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Error checking unified debt milestones:', error);
    return results;
  }
}

/**
 * Get unified debt milestone stats for a household
 */
export async function getUnifiedDebtMilestoneStats(householdId: string) {
  try {
    const unifiedDebts = await getUnifiedDebts(householdId);
    
    const allMilestones = await db
      .select()
      .from(billMilestones)
      .where(eq(billMilestones.householdId, householdId));

    const achievedCount = allMilestones.filter((m) => m.achievedAt).length;
    const totalCount = allMilestones.length;

    // Group by percentage
    const byPercentage = {
      25: { achieved: 0, total: 0 },
      50: { achieved: 0, total: 0 },
      75: { achieved: 0, total: 0 },
      100: { achieved: 0, total: 0 },
    };

    for (const milestone of allMilestones) {
      const pct = milestone.percentage as 25 | 50 | 75 | 100;
      if (byPercentage[pct]) {
        byPercentage[pct].total += 1;
        if (milestone.achievedAt) {
          byPercentage[pct].achieved += 1;
        }
      }
    }

    // Calculate total debt statistics
    const totalRemaining = unifiedDebts.reduce(
      (sum, d) => new Decimal(sum).plus(new Decimal(d.balance)).toNumber(),
      0
    );
    const totalOriginal = unifiedDebts.reduce(
      (sum, d) => new Decimal(sum).plus(new Decimal(d.originalBalance)).toNumber(),
      0
    );
    const percentagePaidOff = totalOriginal > 0 
      ? new Decimal(totalOriginal).minus(totalRemaining).div(totalOriginal).times(100).toNumber()
      : 0;

    return {
      totalDebts: unifiedDebts.length,
      activeDebts: unifiedDebts.filter(d => d.balance > 0).length,
      creditAccounts: unifiedDebts.filter(d => d.source === 'account').length,
      debtBills: unifiedDebts.filter(d => d.source === 'bill').length,
      totalMilestones: totalCount,
      achievedMilestones: achievedCount,
      totalOriginal,
      totalRemaining,
      percentagePaidOff,
      byPercentage,
    };
  } catch (error) {
    console.error('Error getting unified debt milestone stats:', error);
    return {
      totalDebts: 0,
      activeDebts: 0,
      creditAccounts: 0,
      debtBills: 0,
      totalMilestones: 0,
      achievedMilestones: 0,
      totalOriginal: 0,
      totalRemaining: 0,
      percentagePaidOff: 0,
      byPercentage: { 
        25: { achieved: 0, total: 0 }, 
        50: { achieved: 0, total: 0 }, 
        75: { achieved: 0, total: 0 }, 
        100: { achieved: 0, total: 0 } 
      },
    };
  }
}

