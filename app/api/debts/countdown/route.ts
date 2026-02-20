import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, bills, householdSettings, billPayments } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { calculatePayoffStrategy, type DebtInput, type PaymentFrequency } from '@/lib/debts/payoff-calculator';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';

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
  source: 'account' | 'bill';
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

// Unified debt structure for internal use
interface UnifiedDebtData {
  id: string;
  name: string;
  source: 'account' | 'bill';
  remainingBalance: number;
  originalBalance: number;
  minimumPayment: number;
  additionalMonthlyPayment: number;
  interestRate: number;
  type: string;
  loanType: 'revolving' | 'installment';
  includeInStrategy: boolean;
  color: string | null;
  icon: string | null;
  createdAt: string;
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Fetch credit accounts (credit cards + lines of credit) for this household
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

    // Fetch debt bills for this household
    const debtBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.householdId, householdId),
          eq(bills.isDebt, true),
          eq(bills.isActive, true)
        )
      );

    // Normalize to unified debt format
    const unifiedDebts: UnifiedDebtData[] = [];

    // Add credit accounts as debts
    for (const acc of creditAccounts) {
      const balance = new Decimal(
        Math.abs(acc.currentBalanceCents ?? toMoneyCents(acc.currentBalance) ?? 0)
      )
        .div(100)
        .toNumber();
      // Skip accounts with no balance
      if (balance <= 0) continue;

      const originalBalance = new Decimal(
        acc.creditLimitCents ?? toMoneyCents(acc.creditLimit) ?? toMoneyCents(balance) ?? 0
      )
        .div(100)
        .toNumber();
      
      unifiedDebts.push({
        id: acc.id,
        name: acc.name,
        source: 'account',
        remainingBalance: balance,
        originalBalance, // Use credit limit as "original" for credit cards
        minimumPayment: acc.minimumPaymentAmount || 0,
        additionalMonthlyPayment: acc.additionalMonthlyPayment || 0,
        interestRate: acc.interestRate || 0,
        type: acc.type === 'line_of_credit' ? 'line_of_credit' : 'credit_card',
        loanType: 'revolving',
        includeInStrategy: acc.includeInPayoffStrategy ?? true,
        color: acc.color || null,
        icon: acc.icon || null,
        createdAt: acc.createdAt || new Date().toISOString(),
      });
    }

    // Add debt bills
    for (const bill of debtBills) {
      const balance = bill.remainingBalance || 0;
      // Skip bills with no balance
      if (balance <= 0) continue;

      unifiedDebts.push({
        id: bill.id,
        name: bill.name,
        source: 'bill',
        remainingBalance: balance,
        originalBalance: bill.originalBalance || balance,
        minimumPayment: bill.minimumPayment || 0,
        additionalMonthlyPayment: bill.billAdditionalMonthlyPayment || 0,
        interestRate: bill.billInterestRate || 0,
        type: bill.debtType || 'other',
        loanType: bill.debtType === 'mortgage' || bill.debtType === 'auto_loan' || bill.debtType === 'student_loan' ? 'installment' : 'revolving',
        includeInStrategy: bill.includeInPayoffStrategy ?? true,
        color: bill.billColor || null,
        icon: null,
        createdAt: bill.createdAt || new Date().toISOString(),
      });
    }

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

    // Fetch household settings for debt strategy preferences
    const settings = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    const extraPayment = settings.length > 0 ? (settings[0].extraMonthlyPayment || 0) : 0;
    const preferredMethod = settings.length > 0 ? (settings[0].debtPayoffMethod || 'avalanche') : 'avalanche';
    const paymentFrequency: PaymentFrequency = settings.length > 0 
      ? (settings[0].paymentFrequency as PaymentFrequency || 'monthly') 
      : 'monthly';

    // Filter to only include debts in the payoff strategy
    const strategyDebts = unifiedDebts.filter(d => d.includeInStrategy);

    // Transform unified debts to DebtInput format for calculator
    const debtInputs: DebtInput[] = strategyDebts.map(debt => ({
      id: debt.id,
      name: debt.name,
      remainingBalance: debt.remainingBalance,
      minimumPayment: debt.minimumPayment,
      additionalMonthlyPayment: debt.additionalMonthlyPayment || undefined,
      interestRate: debt.interestRate,
      type: debt.type,
      loanType: debt.loanType,
      color: debt.color || undefined,
      icon: debt.icon || undefined,
    }));

    // Calculate payoff strategy
    const strategy = calculatePayoffStrategy(debtInputs, extraPayment, preferredMethod, paymentFrequency);

    // Find the focus debt (the one currently receiving extra payments)
    const focusRolldown = strategy.rolldownPayments.find(rp => rp.isFocusDebt);
    let focusDebt: FocusDebtInfo | null = null;

    if (focusRolldown) {
      // Find the original unified debt data
      const originalDebt = unifiedDebts.find(d => d.id === focusRolldown.debtId);
      
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
        const paidOnDebt = new Decimal(originalDebt.originalBalance).minus(originalDebt.remainingBalance);
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
          color: originalDebt.color,
          icon: originalDebt.icon,
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

    // Fetch payment history from bill_payments to estimate elapsed time
    const paymentHistory = await db
      .select()
      .from(billPayments)
      .where(eq(billPayments.householdId, householdId))
      .orderBy(billPayments.paymentDate);

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
      // Fallback: use earliest debt creation date
      const earliestCreatedAt = unifiedDebts.reduce((earliest, debt) => {
        const debtStart = debt.createdAt ? new Date(debt.createdAt) : new Date();
        return debtStart < earliest ? debtStart : earliest;
      }, new Date());

      const now = new Date();
      monthsElapsed = Math.max(0,
        (now.getFullYear() - earliestCreatedAt.getFullYear()) * 12 +
        (now.getMonth() - earliestCreatedAt.getMonth())
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

    // Get strategy enabled state from settings
    const strategyEnabled = settings.length > 0 ? (settings[0].debtStrategyEnabled ?? false) : false;

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
        creditAccounts: unifiedDebts.filter(d => d.source === 'account').length,
        debtBills: unifiedDebts.filter(d => d.source === 'bill').length,
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
