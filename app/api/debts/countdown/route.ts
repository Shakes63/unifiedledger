import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtSettings, debtPayments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { calculatePayoffStrategy, type DebtInput, type PaymentFrequency } from '@/lib/debts/payoff-calculator';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface Milestone {
  percentage: number;
  monthsAway: number;
  achieved: boolean;
  achievedDate?: string;
}

interface FocusDebtInfo {
  id: string;
  name: string;
  originalAmount: number;
  remainingBalance: number;
  percentagePaid: number;
  interestRate: number;
  payoffDate: string;
  monthsRemaining: number;
  daysRemaining: number;
  currentPayment: number;
  activePayment: number;
  strategyMethod: string;
  color: string | null;
  icon: string | null;
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Fetch user's active debts for this household
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

    // If no active debts, user is debt-free!
    if (activeDebts.length === 0) {
      return Response.json({
        hasDebts: false,
        totalMonthsRemaining: 0,
        totalMonthsOriginal: 0,
        percentageComplete: 100,
        debtFreeDate: new Date().toISOString(),
        totalRemainingBalance: 0,
        milestones: [],
        nextMilestone: null,
      });
    }

    // Fetch user's debt settings for this household
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
    const paymentFrequency: PaymentFrequency = settings.length > 0 ? (settings[0].paymentFrequency as PaymentFrequency || 'monthly') : 'monthly';

    // Transform debts to DebtInput format
    const debtInputs: DebtInput[] = activeDebts.map(debt => ({
      id: debt.id,
      name: debt.name,
      remainingBalance: debt.remainingBalance,
      minimumPayment: debt.minimumPayment || 0,
      interestRate: debt.interestRate || 0,
      type: debt.type || 'other',
      loanType: debt.loanType as 'revolving' | 'installment' | undefined,
      compoundingFrequency: debt.compoundingFrequency as 'daily' | 'monthly' | 'quarterly' | 'annually' | undefined,
      billingCycleDays: debt.billingCycleDays || undefined,
      color: debt.color || undefined,
      icon: debt.icon || undefined,
    }));

    // Calculate payoff strategy
    const strategy = calculatePayoffStrategy(debtInputs, extraPayment, preferredMethod, paymentFrequency);

    // Find the focus debt (the one currently receiving extra payments)
    const focusRolldown = strategy.rolldownPayments.find(rp => rp.isFocusDebt);
    let focusDebt: FocusDebtInfo | null = null;

    if (focusRolldown) {
      // Find the original debt data
      const originalDebt = activeDebts.find(d => d.id === focusRolldown.debtId);
      
      if (originalDebt) {
        // Calculate days remaining until payoff
        const payoffDate = new Date(focusRolldown.payoffDate);
        const now = new Date();
        const timeDiff = payoffDate.getTime() - now.getTime();
        const totalDaysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
        const monthsRemaining = focusRolldown.payoffMonth;
        // Calculate remaining days after full months
        const daysRemaining = totalDaysRemaining - (monthsRemaining * 30);
        
        // Calculate percentage paid for this specific debt
        const paidOnDebt = new Decimal(originalDebt.originalAmount).minus(originalDebt.remainingBalance);
        const percentagePaid = originalDebt.originalAmount > 0
          ? paidOnDebt.dividedBy(originalDebt.originalAmount).times(100).toNumber()
          : 0;

        focusDebt = {
          id: originalDebt.id,
          name: originalDebt.name,
          originalAmount: originalDebt.originalAmount,
          remainingBalance: originalDebt.remainingBalance,
          percentagePaid: Math.round(percentagePaid * 10) / 10,
          interestRate: originalDebt.interestRate || 0,
          payoffDate: payoffDate.toISOString(),
          monthsRemaining,
          daysRemaining: Math.max(0, daysRemaining),
          currentPayment: focusRolldown.currentPayment,
          activePayment: focusRolldown.activePayment,
          strategyMethod: preferredMethod,
          color: originalDebt.color,
          icon: originalDebt.icon,
        };
      }
    }

    // Calculate total original debt and total remaining
    const totalOriginalDebt = activeDebts.reduce(
      (sum, debt) => new Decimal(sum).plus(debt.originalAmount).toNumber(),
      0
    );
    const totalRemainingBalance = activeDebts.reduce(
      (sum, debt) => new Decimal(sum).plus(debt.remainingBalance).toNumber(),
      0
    );

    // Calculate percentage complete based on amount paid
    const totalPaid = new Decimal(totalOriginalDebt).minus(totalRemainingBalance);
    const percentageComplete = totalOriginalDebt > 0
      ? new Decimal(totalPaid).dividedBy(totalOriginalDebt).times(100).toNumber()
      : 0;

    // Fetch payment history to get earliest payment date (for elapsed time calculation)
    const paymentHistory = await db
      .select()
      .from(debtPayments)
      .where(
        and(
          eq(debtPayments.userId, userId),
          eq(debtPayments.householdId, householdId)
        )
      )
      .orderBy(debtPayments.paymentDate);

    // Calculate months elapsed based on payment history or debt start dates
    let monthsElapsed = 0;
    if (paymentHistory.length > 0) {
      const earliestPayment = new Date(paymentHistory[0].paymentDate);
      const now = new Date();
      monthsElapsed = Math.max(0,
        (now.getFullYear() - earliestPayment.getFullYear()) * 12 +
        (now.getMonth() - earliestPayment.getMonth())
      );
    } else {
      // Fallback: use earliest debt start date
      const earliestStartDate = activeDebts.reduce((earliest, debt) => {
        const debtStart = debt.startDate ? new Date(debt.startDate) : new Date();
        return debtStart < earliest ? debtStart : earliest;
      }, new Date());

      const now = new Date();
      monthsElapsed = Math.max(0,
        (now.getFullYear() - earliestStartDate.getFullYear()) * 12 +
        (now.getMonth() - earliestStartDate.getMonth())
      );
    }

    // Calculate original total months (months elapsed + months remaining)
    const totalMonthsOriginal = monthsElapsed + strategy.totalMonths;

    // Calculate time-based percentage (use whichever is higher for motivation)
    const timeBasedPercentage = totalMonthsOriginal > 0
      ? (monthsElapsed / totalMonthsOriginal) * 100
      : 0;

    // Use the higher percentage (more motivating)
    const finalPercentage = Math.max(percentageComplete, timeBasedPercentage);

    // Calculate milestones based on percentage complete
    const milestones: Milestone[] = [25, 50, 75, 100].map(percentage => {
      const achieved = finalPercentage >= percentage;

      // Calculate months away for unachieved milestones
      let monthsAway = 0;
      if (!achieved) {
        // Estimate based on current rate of progress
        const percentageRemaining = percentage - finalPercentage;
        const monthsPerPercent = monthsElapsed > 0 ? monthsElapsed / finalPercentage : 1;
        monthsAway = Math.ceil(percentageRemaining * monthsPerPercent);
      }

      return {
        percentage,
        monthsAway,
        achieved,
        achievedDate: achieved ? new Date().toISOString() : undefined,
      };
    });

    // Find next milestone
    const nextMilestone = milestones.find(m => !m.achieved);

    return Response.json({
      hasDebts: true,
      totalMonthsRemaining: strategy.totalMonths,
      totalMonthsOriginal,
      monthsElapsed,
      percentageComplete: Math.round(finalPercentage * 10) / 10, // Round to 1 decimal
      debtFreeDate: strategy.debtFreeDate,
      totalRemainingBalance,
      totalOriginalDebt,
      totalPaid: totalPaid.toNumber(),
      milestones,
      nextMilestone: nextMilestone ? {
        percentage: nextMilestone.percentage,
        monthsAway: nextMilestone.monthsAway,
      } : null,
      focusDebt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error calculating debt countdown:', error);
    return Response.json({ error: 'Failed to calculate countdown' }, { status: 500 });
  }
}
