/**
 * Debt Payoff Date Sync Utilities
 *
 * Automatically calculates and persists projected payoff dates for debts.
 * This enables debt target dates to appear on the calendar.
 */

import { db } from '@/lib/db';
import { debts, debtSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { calculatePayoffStrategy, type DebtInput, type PaymentFrequency } from './payoff-calculator';
import { format } from 'date-fns';

/**
 * Calculate and update targetPayoffDate for a single debt
 * Uses the payoff calculator to project when the debt will be paid off
 *
 * @param debtId - ID of the debt to sync
 * @param userId - ID of the user who owns the debt
 * @param householdId - ID of the household
 * @returns Object with success status and calculated payoff date
 */
export async function syncDebtPayoffDate(
  debtId: string,
  userId: string,
  householdId: string
): Promise<{ success: boolean; payoffDate: string | null }> {
  try {
    // Get the debt
    const debt = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.id, debtId),
          eq(debts.userId, userId),
          eq(debts.householdId, householdId)
        )
      )
      .then(res => res[0]);

    if (!debt || debt.status !== 'active') {
      return { success: false, payoffDate: null };
    }

    // If debt is already paid off (balance = 0), set status and clear payoff date
    if (debt.remainingBalance <= 0) {
      await db
        .update(debts)
        .set({
          targetPayoffDate: null,
          status: 'paid_off',
          updatedAt: new Date().toISOString()
        })
        .where(eq(debts.id, debtId));
      return { success: true, payoffDate: null };
    }

    // Get user's debt settings
    const settings = await db
      .select()
      .from(debtSettings)
      .where(
        and(
          eq(debtSettings.userId, userId),
          eq(debtSettings.householdId, householdId)
        )
      )
      .limit(1);

    const extraPayment = settings.length > 0 ? (settings[0].extraMonthlyPayment || 0) : 0;
    const preferredMethod = settings.length > 0 ? (settings[0].preferredMethod || 'avalanche') : 'avalanche';
    const paymentFrequency: PaymentFrequency = settings.length > 0
      ? (settings[0].paymentFrequency as PaymentFrequency || 'monthly')
      : 'monthly';

    // Create debt input for calculator
    const debtInput: DebtInput = {
      id: debt.id,
      name: debt.name,
      remainingBalance: debt.remainingBalance,
      minimumPayment: debt.minimumPayment || 0,
      additionalMonthlyPayment: debt.additionalMonthlyPayment || 0,
      interestRate: debt.interestRate || 0,
      type: debt.type || 'other',
      loanType: debt.loanType as 'revolving' | 'installment' | undefined,
      compoundingFrequency: debt.compoundingFrequency as 'daily' | 'monthly' | 'quarterly' | 'annually' | undefined,
      billingCycleDays: debt.billingCycleDays || undefined,
    };

    // Calculate payoff strategy for this single debt
    const strategy = calculatePayoffStrategy([debtInput], extraPayment, preferredMethod, paymentFrequency);
    const schedule = strategy.schedules.find(s => s.debtId === debtId);

    if (!schedule) {
      return { success: false, payoffDate: null };
    }

    const payoffDate = format(schedule.payoffDate, 'yyyy-MM-dd');

    // Update the debt with the calculated payoff date
    await db
      .update(debts)
      .set({
        targetPayoffDate: payoffDate,
        updatedAt: new Date().toISOString()
      })
      .where(eq(debts.id, debtId));

    return { success: true, payoffDate };
  } catch (error) {
    console.error('Error syncing debt payoff date:', error);
    return { success: false, payoffDate: null };
  }
}

/**
 * Sync payoff dates for all active debts in a household
 * Useful for bulk updates when settings change
 *
 * @param userId - ID of the user
 * @param householdId - ID of the household
 * @returns Object with count of synced and failed debts
 */
export async function syncAllDebtPayoffDates(
  userId: string,
  householdId: string
): Promise<{ synced: number; failed: number }> {
  try {
    const activeDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
          eq(debts.householdId, householdId),
          eq(debts.status, 'active')
        )
      );

    let synced = 0;
    let failed = 0;

    for (const debt of activeDebts) {
      const result = await syncDebtPayoffDate(debt.id, userId, householdId);
      if (result.success) {
        synced++;
      } else {
        failed++;
      }
    }

    return { synced, failed };
  } catch (error) {
    console.error('Error syncing all debt payoff dates:', error);
    return { synced: 0, failed: 0 };
  }
}

