import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billPaymentEvents, debtPayments, transactions } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { calculatePayoffStrategy, type DebtInput, type PaymentFrequency } from '@/lib/debts/payoff-calculator';
import Decimal from 'decimal.js';
import { getDebtStrategySettings, getUnifiedDebtSources, toDebtInputs } from '@/lib/debts/unified-debt-sources';

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
  source: 'account' | 'bill' | 'debt';
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

    const unifiedDebts = await getUnifiedDebtSources(householdId);

    // If no unified debts, user is debt-free!
    if (unifiedDebts.length === 0) {
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

    const settings = await getDebtStrategySettings(userId, householdId);
    const extraPayment = settings.extraMonthlyPayment || 0;
    const preferredMethod = settings.preferredMethod || 'avalanche';
    const paymentFrequency: PaymentFrequency = settings.paymentFrequency || 'monthly';

    // Filter to only include debts in the payoff strategy
    const strategyDebts = unifiedDebts.filter((d) => d.includeInPayoffStrategy);
    const debtInputs: DebtInput[] = toDebtInputs(strategyDebts, { inStrategyOnly: false });

    // Calculate payoff strategy
    const strategy = calculatePayoffStrategy(debtInputs, extraPayment, preferredMethod, paymentFrequency);

    // Find the focus debt (the one currently receiving extra payments)
    const focusRolldown = strategy.rolldownPayments.find(rp => rp.isFocusDebt);
    let focusDebt: FocusDebtInfo | null = null;

    if (focusRolldown) {
      // Find the original unified debt data
      const originalDebt = unifiedDebts.find((d) => d.id === focusRolldown.debtId);
      
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
        const paidOnDebt = new Decimal(originalDebt.originalBalance).minus(
          originalDebt.remainingBalance
        );
        const percentagePaid = originalDebt.originalBalance > 0
          ? paidOnDebt.dividedBy(originalDebt.originalBalance).times(100).toNumber()
          : 0;

        focusDebt = {
          id: originalDebt.id,
          name: originalDebt.name,
          source: originalDebt.source,
          originalAmount: originalDebt.originalBalance,
          remainingBalance: originalDebt.remainingBalance,
          percentagePaid: Math.round(percentagePaid * 10) / 10,
          interestRate: originalDebt.interestRate,
          payoffDate: payoffDate.toISOString(),
          monthsRemaining,
          daysRemaining: Math.max(0, daysRemaining),
          currentPayment: focusRolldown.currentPayment,
          activePayment: focusRolldown.activePayment,
          strategyMethod: preferredMethod,
          color: originalDebt.color || null,
          icon: originalDebt.icon || null,
        };
      }
    }

    // Calculate total original debt and total remaining (from all debts, not just strategy)
    const totalOriginalDebt = unifiedDebts.reduce(
      (sum, debt) => new Decimal(sum).plus(debt.originalBalance).toNumber(),
      0
    );
    const totalRemainingBalance = unifiedDebts.reduce(
      (sum, debt) => new Decimal(sum).plus(debt.remainingBalance).toNumber(),
      0
    );

    // Calculate percentage complete based on amount paid
    const totalPaid = new Decimal(totalOriginalDebt).minus(totalRemainingBalance);
    const percentageComplete = totalOriginalDebt > 0
      ? new Decimal(totalPaid).dividedBy(totalOriginalDebt).times(100).toNumber()
      : 0;

    // Fetch payment history from both bill + debt payment tables to estimate elapsed time
    const billDebtIds = unifiedDebts
      .filter((debt) => debt.source === 'bill')
      .map((debt) => debt.id);
    const [billPaymentHistory, legacyBillTxHistory, debtPaymentHistory] = await Promise.all([
      billDebtIds.length > 0
        ? db
            .select({ paymentDate: billPaymentEvents.paymentDate })
            .from(billPaymentEvents)
            .where(
              and(
                eq(billPaymentEvents.householdId, householdId),
                inArray(billPaymentEvents.templateId, billDebtIds)
              )
            )
        : Promise.resolve([]),
      billDebtIds.length > 0
        ? db
            .select({ paymentDate: transactions.date })
            .from(transactions)
            .where(
              and(
                eq(transactions.householdId, householdId),
                eq(transactions.userId, userId),
                inArray(transactions.billId, billDebtIds)
              )
            )
        : Promise.resolve([]),
      db
        .select({ paymentDate: debtPayments.paymentDate })
        .from(debtPayments)
        .where(eq(debtPayments.householdId, householdId)),
    ]);
    const paymentHistory = [...billPaymentHistory, ...legacyBillTxHistory, ...debtPaymentHistory].sort((a, b) =>
      new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
    );

    // Calculate months elapsed based on payment history or debt creation dates
    let monthsElapsed = 0;
    if (paymentHistory.length > 0) {
      const earliestPayment = new Date(paymentHistory[0].paymentDate);
      const now = new Date();
      monthsElapsed = Math.max(0,
        (now.getFullYear() - earliestPayment.getFullYear()) * 12 +
        (now.getMonth() - earliestPayment.getMonth())
      );
    } else {
      // Without payment history, we cannot infer elapsed payoff time reliably.
      monthsElapsed = 0;
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

    // Get strategy enabled state from settings
    const strategyEnabled = settings.debtStrategyEnabled ?? false;

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
      // Strategy settings
      strategyEnabled,
      payoffMethod: preferredMethod,
      // Include source breakdown for debugging/UI
      sources: {
        creditAccounts: unifiedDebts.filter((d) => d.source === 'account').length,
        debtBills: unifiedDebts.filter((d) => d.source === 'bill').length,
        standaloneDebts: unifiedDebts.filter((d) => d.source === 'debt').length,
      },
    });
  } catch (error) {
    // Auth errors (requireAuth throws "Unauthorized")
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Household membership errors (requireHouseholdAuth throws "Unauthorized: Not a member...")
    if (error instanceof Error && error.message.includes('Unauthorized:')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    // Household ID missing
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error calculating debt countdown:', error);
    return Response.json({ error: 'Failed to calculate countdown' }, { status: 500 });
  }
}
