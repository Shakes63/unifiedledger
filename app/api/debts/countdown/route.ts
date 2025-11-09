import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { debts, debtSettings, debtPayments } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { calculatePayoffStrategy, type DebtInput } from '@/lib/debts/payoff-calculator';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface Milestone {
  percentage: number;
  monthsAway: number;
  achieved: boolean;
  achievedDate?: string;
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's active debts
    const activeDebts = await db
      .select()
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

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

    // Fetch user's debt settings
    const settings = await db
      .select()
      .from(debtSettings)
      .where(eq(debtSettings.userId, userId))
      .limit(1);

    const extraPayment = settings.length > 0 ? (settings[0].extraMonthlyPayment || 0) : 0;
    const preferredMethod = settings.length > 0 ? (settings[0].preferredMethod || 'avalanche') : 'avalanche';

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
    const strategy = calculatePayoffStrategy(debtInputs, extraPayment, preferredMethod);

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
      .where(eq(debtPayments.userId, userId))
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
    });
  } catch (error) {
    console.error('Error calculating debt countdown:', error);
    return Response.json({ error: 'Failed to calculate countdown' }, { status: 500 });
  }
}
