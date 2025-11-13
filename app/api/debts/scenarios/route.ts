import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { debts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  calculateScenarioComparison,
  type PayoffScenario,
  type DebtInput,
} from '@/lib/debts/payoff-calculator';

export const dynamic = 'force-dynamic';

/**
 * POST /api/debts/scenarios
 *
 * Calculate and compare multiple what-if scenarios
 *
 * Request body:
 * {
 *   "scenarios": [
 *     {
 *       "name": "Current Plan",
 *       "extraMonthlyPayment": 300,
 *       "lumpSumPayments": [],
 *       "method": "avalanche"
 *     },
 *     {
 *       "name": "Extra $100/month",
 *       "extraMonthlyPayment": 400,
 *       "lumpSumPayments": [],
 *       "method": "avalanche"
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { scenarios } = body;

    // Validate scenarios array
    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return NextResponse.json(
        { error: 'Scenarios array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate each scenario
    for (const scenario of scenarios) {
      if (!scenario.name || typeof scenario.name !== 'string') {
        return NextResponse.json(
          { error: 'Each scenario must have a name' },
          { status: 400 }
        );
      }

      if (typeof scenario.extraMonthlyPayment !== 'number' || scenario.extraMonthlyPayment < 0) {
        return NextResponse.json(
          { error: 'extraMonthlyPayment must be a non-negative number' },
          { status: 400 }
        );
      }

      if (!Array.isArray(scenario.lumpSumPayments)) {
        return NextResponse.json(
          { error: 'lumpSumPayments must be an array' },
          { status: 400 }
        );
      }

      if (!['snowball', 'avalanche'].includes(scenario.method)) {
        return NextResponse.json(
          { error: 'method must be either "snowball" or "avalanche"' },
          { status: 400 }
        );
      }

      // Validate payment frequency if provided
      if (scenario.paymentFrequency && !['monthly', 'biweekly'].includes(scenario.paymentFrequency)) {
        return NextResponse.json(
          { error: 'paymentFrequency must be either "monthly" or "biweekly"' },
          { status: 400 }
        );
      }

      // Validate lump sum payments
      for (const lumpSum of scenario.lumpSumPayments) {
        if (typeof lumpSum.month !== 'number' || lumpSum.month < 1) {
          return NextResponse.json(
            { error: 'Lump sum month must be a positive number' },
            { status: 400 }
          );
        }

        if (typeof lumpSum.amount !== 'number' || lumpSum.amount <= 0) {
          return NextResponse.json(
            { error: 'Lump sum amount must be a positive number' },
            { status: 400 }
          );
        }
      }
    }

    // Fetch all active debts for the user
    const activeDebts = await db
      .select()
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

    if (activeDebts.length === 0) {
      return NextResponse.json(
        { error: 'No active debts found' },
        { status: 404 }
      );
    }

    // Map debts to calculator input format
    const debtInputs: DebtInput[] = activeDebts.map((debt) => ({
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

    // Calculate scenario comparison
    const comparison = calculateScenarioComparison(debtInputs, scenarios);

    return NextResponse.json(comparison);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error calculating scenarios:', error);
    return NextResponse.json(
      { error: 'Failed to calculate scenarios' },
      { status: 500 }
    );
  }
}
