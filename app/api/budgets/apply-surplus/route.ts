import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { debts, debtSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { calculatePayoffStrategy, type DebtInput, type PayoffMethod, type PaymentFrequency } from '@/lib/debts/payoff-calculator';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    // 1. Get amount from request
    const body = await request.json();
    const { amount } = body;

    if (typeof amount !== 'number' || amount < 0) {
      return Response.json(
        { error: 'Invalid amount. Must be a positive number.' },
        { status: 400 }
      );
    }

    // 2. Get current settings
    const settings = await db
      .select()
      .from(debtSettings)
      .where(eq(debtSettings.userId, userId))
      .limit(1);

    const currentExtraPayment = settings[0]?.extraMonthlyPayment || 0;
    const preferredMethod = (settings[0]?.preferredMethod || 'avalanche') as PayoffMethod;
    const paymentFrequency = (settings[0]?.paymentFrequency || 'monthly') as PaymentFrequency;

    // 3. Calculate new total extra payment
    const newExtraPayment = new Decimal(currentExtraPayment)
      .plus(amount)
      .toNumber();

    // 4. Update or create settings
    if (settings.length === 0) {
      // Create new settings
      await db.insert(debtSettings).values({
        id: nanoid(),
        userId,
        extraMonthlyPayment: newExtraPayment,
        preferredMethod,
        paymentFrequency,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Update existing settings
      await db
        .update(debtSettings)
        .set({
          extraMonthlyPayment: newExtraPayment,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(debtSettings.userId, userId));
    }

    // 5. Get active debts to calculate new projections
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
        success: true,
        newExtraPayment,
        updatedProjections: null,
        message: 'Extra payment updated, but no active debts to calculate projections.',
      });
    }

    // 6. Prepare debt inputs
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

    // 7. Calculate new payoff projections
    const newProjections = calculatePayoffStrategy(
      debtInputs,
      newExtraPayment,
      preferredMethod,
      paymentFrequency
    );

    // 8. Return success with projections
    return Response.json({
      success: true,
      newExtraPayment,
      amountApplied: amount,
      updatedProjections: {
        monthsToDebtFree: newProjections.totalMonths,
        debtFreeDate: newProjections.debtFreeDate.toISOString(),
        totalInterest: Math.round(newProjections.totalInterestPaid),
        method: preferredMethod,
        frequency: paymentFrequency,
      },
      message: `Successfully applied $${amount.toFixed(2)} to your extra monthly payment`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Apply surplus error:', error);
    return Response.json(
      { error: 'Failed to apply surplus to debt payments' },
      { status: 500 }
    );
  }
}
