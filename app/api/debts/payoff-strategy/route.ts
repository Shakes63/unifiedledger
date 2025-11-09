import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { debts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  calculatePayoffStrategy,
  comparePayoffMethods,
  type PayoffMethod,
  type DebtInput
} from '@/lib/debts/payoff-calculator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const method = (searchParams.get('method') || 'avalanche') as PayoffMethod;
    const extraPayment = parseFloat(searchParams.get('extraPayment') || '0');
    const compare = searchParams.get('compare') === 'true';

    // Fetch all active debts
    const activeDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
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
      const comparison = comparePayoffMethods(debtInputs, extraPayment);
      return NextResponse.json(comparison);
    } else {
      const strategy = calculatePayoffStrategy(debtInputs, extraPayment, method);
      return NextResponse.json(strategy);
    }

  } catch (error) {
    console.error('Error calculating payoff strategy:', error);
    return NextResponse.json(
      { error: 'Failed to calculate payoff strategy' },
      { status: 500 }
    );
  }
}
