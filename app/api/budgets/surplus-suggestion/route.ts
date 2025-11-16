import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { calculatePayoffStrategy, type DebtInput, type PayoffMethod, type PaymentFrequency } from '@/lib/debts/payoff-calculator';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // 1. Fetch budget summary
    const summaryResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/budgets/summary`,
      {
        headers: {
          'x-household-id': householdId,
          Cookie: `__session=${userId}`, // Pass auth
        },
      }
    );

    if (!summaryResponse.ok) {
      throw new Error('Failed to fetch budget summary');
    }

    const summary = await summaryResponse.json();

    // 2. If no surplus or no debts, return no suggestion
    if (!summary.hasSurplus || !summary.hasDebts || summary.availableToApply <= 0) {
      return Response.json({
        hasSuggestion: false,
        availableAmount: summary.availableToApply || 0,
        reason: !summary.hasDebts
          ? 'no_debts'
          : !summary.hasSurplus
          ? 'no_surplus'
          : 'negative_surplus',
      });
    }

    // 3. Get active debts for calculation
    // TODO: Add householdId filter when debts table is updated in Phase 3
    const activeDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
          eq(debts.status, 'active')
        )
      );

    if (activeDebts.length === 0) {
      return Response.json({
        hasSuggestion: false,
        availableAmount: summary.availableToApply,
        reason: 'no_debts',
      });
    }

    // 4. Get user's debt settings (method and frequency)
    const settings = await db
      .select()
      .from(debtSettings)
      .where(eq(debtSettings.userId, userId))
      .limit(1);

    const preferredMethod = (settings[0]?.preferredMethod || 'avalanche') as PayoffMethod;
    const paymentFrequency = (settings[0]?.paymentFrequency || 'monthly') as PaymentFrequency;
    const currentExtraPayment = summary.currentExtraPayment || 0;

    // 5. Prepare debt inputs for calculator
    const debtInputs: DebtInput[] = activeDebts.map(debt => ({
      id: debt.id,
      name: debt.name || 'Unknown Debt',
      remainingBalance: debt.remainingBalance || 0,
      minimumPayment: debt.minimumPayment || 0,
      interestRate: debt.interestRate || 0,
      type: debt.type || 'credit_card',
      loanType: debt.loanType as 'revolving' | 'installment' | undefined,
      compoundingFrequency: debt.compoundingFrequency as 'daily' | 'monthly' | 'quarterly' | 'annually' | undefined,
      billingCycleDays: debt.billingCycleDays || undefined,
      color: debt.color || undefined,
      icon: debt.icon || undefined,
    }));

    // 6. Calculate current plan (with current extra payment)
    const currentPlan = calculatePayoffStrategy(
      debtInputs,
      currentExtraPayment,
      preferredMethod,
      paymentFrequency
    );

    // 7. Calculate suggested plan (with surplus applied)
    const suggestedExtraPayment = new Decimal(currentExtraPayment)
      .plus(summary.suggestedExtraPayment)
      .toNumber();

    const suggestedPlan = calculatePayoffStrategy(
      debtInputs,
      suggestedExtraPayment,
      preferredMethod,
      paymentFrequency
    );

    // 8. Calculate impact
    const monthsSaved = currentPlan.totalMonths - suggestedPlan.totalMonths;
    const interestSaved = new Decimal(currentPlan.totalInterestPaid)
      .minus(suggestedPlan.totalInterestPaid)
      .toNumber();

    const percentageFaster = currentPlan.totalMonths > 0
      ? new Decimal(monthsSaved).div(currentPlan.totalMonths).times(100).toNumber()
      : 0;

    // 9. Create suggestion message
    const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const message = `Applying ${formatCurrency(summary.suggestedExtraPayment)} extra would save you ${monthsSaved} month${monthsSaved !== 1 ? 's' : ''} and ${formatCurrency(interestSaved)} in interest`;

    return Response.json({
      hasSuggestion: true,
      availableAmount: summary.availableToApply,
      currentPlan: {
        extraPayment: currentExtraPayment,
        monthsToDebtFree: currentPlan.totalMonths,
        debtFreeDate: currentPlan.debtFreeDate.toISOString(),
        totalInterest: Math.round(currentPlan.totalInterestPaid),
      },
      suggestedPlan: {
        extraPayment: suggestedExtraPayment,
        monthsToDebtFree: suggestedPlan.totalMonths,
        debtFreeDate: suggestedPlan.debtFreeDate.toISOString(),
        totalInterest: Math.round(suggestedPlan.totalInterestPaid),
      },
      impact: {
        monthsSaved,
        interestSaved: Math.round(interestSaved),
        percentageFaster: Math.round(percentageFaster),
      },
      message,
      method: preferredMethod,
      frequency: paymentFrequency,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Surplus suggestion error:', error);
    return Response.json(
      { error: 'Failed to calculate surplus suggestion' },
      { status: 500 }
    );
  }
}
