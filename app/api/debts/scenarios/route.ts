import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import {
  calculateScenarioComparison,
  type DebtInput,
} from '@/lib/debts/payoff-calculator';
import { getUnifiedDebtSources, toDebtInputs } from '@/lib/debts/unified-debt-sources';

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
    const { householdId } = await getAndVerifyHousehold(request, userId, body);
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
      if (scenario.paymentFrequency && !['weekly', 'biweekly', 'monthly', 'quarterly'].includes(scenario.paymentFrequency)) {
        return NextResponse.json(
          { error: 'paymentFrequency must be one of: weekly, biweekly, monthly, quarterly' },
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

    const unifiedDebts = await getUnifiedDebtSources(householdId);

    if (unifiedDebts.length === 0) {
      return NextResponse.json(
        { error: 'No active debts found' },
        { status: 404 }
      );
    }

    const debtInputs: DebtInput[] = toDebtInputs(unifiedDebts, { inStrategyOnly: true });

    if (debtInputs.length === 0) {
      return NextResponse.json(
        { error: 'No debts are currently included in the payoff strategy' },
        { status: 404 }
      );
    }

    // Calculate scenario comparison
    const comparison = calculateScenarioComparison(debtInputs, scenarios);

    return NextResponse.json(comparison);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error calculating scenarios:', error);
    return NextResponse.json(
      { error: 'Failed to calculate scenarios' },
      { status: 500 }
    );
  }
}
