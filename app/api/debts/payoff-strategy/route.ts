import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import {
  calculatePayoffStrategy,
  comparePayoffMethods,
  type PayoffMethod,
  type PaymentFrequency,
  type DebtInput
} from '@/lib/debts/payoff-calculator';
import {
  getDebtStrategySettings,
  getUnifiedDebtSources,
  isValidPaymentFrequency,
  isValidPayoffMethod,
  toDebtInputs,
  type UnifiedDebtSource,
} from '@/lib/debts/unified-debt-sources';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { searchParams } = new URL(request.url);

    const requestedMethod = searchParams.get('method');
    const extraPaymentParam = searchParams.get('extraPayment');
    const requestedFrequency = searchParams.get('paymentFrequency');
    const compare = searchParams.get('compare') === 'true';
    const inStrategyOnly = searchParams.get('inStrategyOnly') !== 'false'; // Default to true

    const settings = await getDebtStrategySettings(userId, householdId);
    const parsedExtraPayment = extraPaymentParam !== null
      ? Number.parseFloat(extraPaymentParam)
      : Number.NaN;
    const effectiveExtraPayment = Number.isFinite(parsedExtraPayment)
      ? Math.max(0, parsedExtraPayment)
      : settings.extraMonthlyPayment;
    const effectiveMethod: PayoffMethod = isValidPayoffMethod(requestedMethod)
      ? requestedMethod
      : settings.preferredMethod;
    const paymentFrequency: PaymentFrequency = isValidPaymentFrequency(requestedFrequency)
      ? requestedFrequency
      : settings.paymentFrequency;

    // Build unified debt list
    const unifiedDebts = await getUnifiedDebtSources(householdId);
    const allDebts: UnifiedDebtSource[] = unifiedDebts.map((debt) => ({
      ...debt,
      source: debt.source,
      sourceType: debt.sourceType,
      includeInPayoffStrategy: debt.includeInPayoffStrategy,
    }));

    const includedDebts = inStrategyOnly
      ? allDebts.filter((debt) => debt.includeInPayoffStrategy)
      : allDebts;
    const excludedDebts = allDebts.filter((debt) => !debt.includeInPayoffStrategy);

    if (includedDebts.length === 0) {
      return NextResponse.json({
        message: 'No active debts in payoff strategy',
        debts: [],
        strategy: null,
        excludedDebts: {
          count: excludedDebts.length,
          totalBalance: excludedDebts.reduce((sum, d) => sum + d.remainingBalance, 0),
          items: excludedDebts,
        },
      });
    }

    // Calculate strategy or comparison
    // Transform to base DebtInput (remove source fields for calculator)
    const debtInputs: DebtInput[] = toDebtInputs(includedDebts, { inStrategyOnly: false });
    const sourceByDebtId = new Map(
      allDebts.map((debt) => [debt.id, { source: debt.source, sourceType: debt.sourceType }])
    );

    if (compare) {
      const comparison = comparePayoffMethods(debtInputs, effectiveExtraPayment, paymentFrequency);
      
      // Enhance payoff order with source info
      const enhancePayoffOrder = (order: typeof comparison.snowball.payoffOrder) => {
        return order.map(item => {
          const sourceDebt = sourceByDebtId.get(item.debtId);
          return {
            ...item,
            source: sourceDebt?.source || 'bill',
            sourceType: sourceDebt?.sourceType || 'other',
          };
        });
      };

      return NextResponse.json({
        ...comparison,
        snowball: {
          ...comparison.snowball,
          payoffOrder: enhancePayoffOrder(comparison.snowball.payoffOrder),
        },
        avalanche: {
          ...comparison.avalanche,
          payoffOrder: enhancePayoffOrder(comparison.avalanche.payoffOrder),
        },
        excludedDebts: {
          count: excludedDebts.length,
          totalBalance: excludedDebts.reduce((sum, d) => sum + d.remainingBalance, 0),
          items: excludedDebts,
        },
      });
    } else {
      const strategy = calculatePayoffStrategy(
        debtInputs, 
        effectiveExtraPayment, 
        effectiveMethod, 
        paymentFrequency
      );

      // Enhance payoff order with source info
      const enhancedPayoffOrder = strategy.payoffOrder.map(item => {
        const sourceDebt = sourceByDebtId.get(item.debtId);
        return {
          ...item,
          source: sourceDebt?.source || 'bill',
          sourceType: sourceDebt?.sourceType || 'other',
        };
      });

      // Enhance rolldown payments with source info
      const enhancedRolldownPayments = strategy.rolldownPayments.map(item => {
        const sourceDebt = sourceByDebtId.get(item.debtId);
        return {
          ...item,
          source: sourceDebt?.source || 'bill',
          sourceType: sourceDebt?.sourceType || 'other',
        };
      });

      return NextResponse.json({
        ...strategy,
        payoffOrder: enhancedPayoffOrder,
        rolldownPayments: enhancedRolldownPayments,
        excludedDebts: {
          count: excludedDebts.length,
          totalBalance: excludedDebts.reduce((sum, d) => sum + d.remainingBalance, 0),
          items: excludedDebts,
        },
      });
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
