import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  calculatePayoffStrategy,
  comparePayoffMethods,
  type PayoffMethod,
  type PaymentFrequency,
  type DebtInput
} from '@/lib/debts/payoff-calculator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { searchParams } = new URL(request.url);

    const method = (searchParams.get('method') || 'avalanche') as PayoffMethod;
    const extraPayment = parseFloat(searchParams.get('extraPayment') || '0');
    const compare = searchParams.get('compare') === 'true';

    // Fetch payment frequency from settings for this household
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

    const paymentFrequency: PaymentFrequency = (settings[0]?.paymentFrequency as PaymentFrequency) || 'monthly';

    // Fetch all active debts for this household
    const activeDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
          eq(debts.householdId, householdId),
          eq(debts.status, 'active')
        )
      )
      .orderBy(debts.name);

    if (activeDebts.length === 0) {
      return NextResponse.json({
        message: 'No active debts found',
        debts: [],
        strategy: null,
      });
    }

    // Transform to DebtInput format
    const debtInputs: DebtInput[] = activeDebts.map(debt => ({
      id: debt.id,
      name: debt.name,
      remainingBalance: debt.remainingBalance,
      minimumPayment: debt.minimumPayment || 0,
      additionalMonthlyPayment: debt.additionalMonthlyPayment || 0,
      interestRate: debt.interestRate || 0,
      type: debt.type || 'other',
      loanType: debt.loanType || 'revolving',
      compoundingFrequency: debt.compoundingFrequency || 'monthly',
      billingCycleDays: debt.billingCycleDays || 30,
      color: debt.color || undefined,
      icon: debt.icon || undefined,
    }));

    // Calculate strategy or comparison
    if (compare) {
      const comparison = comparePayoffMethods(debtInputs, extraPayment, paymentFrequency);
      return NextResponse.json(comparison);
    } else {
      const strategy = calculatePayoffStrategy(debtInputs, extraPayment, method, paymentFrequency);
      return NextResponse.json(strategy);
    }

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error calculating payoff strategy:', error);
    return NextResponse.json(
      { error: 'Failed to calculate payoff strategy' },
      { status: 500 }
    );
  }
}
