import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, bills, householdSettings } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  calculatePayoffStrategy,
  comparePayoffMethods,
  type PayoffMethod,
  type PaymentFrequency,
  type DebtInput
} from '@/lib/debts/payoff-calculator';

export const dynamic = 'force-dynamic';

// Extended interface to track debt source
interface UnifiedDebtInput extends DebtInput {
  source: 'account' | 'bill';
  sourceType: string;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { searchParams } = new URL(request.url);

    const method = (searchParams.get('method') || 'avalanche') as PayoffMethod;
    const extraPayment = parseFloat(searchParams.get('extraPayment') || '0');
    const compare = searchParams.get('compare') === 'true';
    const inStrategyOnly = searchParams.get('inStrategyOnly') !== 'false'; // Default to true

    // Fetch settings from householdSettings
    const settings = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    const paymentFrequency: PaymentFrequency = 
      (settings[0]?.paymentFrequency as PaymentFrequency) || 'monthly';
    const effectiveExtraPayment = extraPayment || settings[0]?.extraMonthlyPayment || 0;
    const effectiveMethod = method || 
      (settings[0]?.debtPayoffMethod as PayoffMethod) || 'avalanche';

    // Fetch credit accounts (credit cards + lines of credit)
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

    // Fetch debt bills
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

    // Build unified debt list
    const allDebts: UnifiedDebtInput[] = [];
    const excludedDebts: UnifiedDebtInput[] = [];

    // Add credit accounts
    for (const acc of creditAccounts) {
      const balance = Math.abs(acc.currentBalance || 0);
      
      // Skip accounts with zero balance
      if (balance <= 0) continue;

      const debt: UnifiedDebtInput = {
        id: acc.id,
        name: acc.name,
        remainingBalance: balance,
        minimumPayment: acc.minimumPaymentAmount || 0,
        additionalMonthlyPayment: acc.budgetedMonthlyPayment 
          ? Math.max(0, acc.budgetedMonthlyPayment - (acc.minimumPaymentAmount || 0))
          : 0,
        interestRate: acc.interestRate || 0,
        type: acc.type,
        loanType: acc.type === 'credit' ? 'revolving' : 'revolving', // Lines of credit are also revolving
        compoundingFrequency: (acc.interestType === 'variable' ? 'daily' : 'monthly') as 'daily' | 'monthly',
        billingCycleDays: 30,
        color: acc.color || undefined,
        source: 'account',
        sourceType: acc.type,
      };

      if (inStrategyOnly && !acc.includeInPayoffStrategy) {
        excludedDebts.push(debt);
      } else if (acc.includeInPayoffStrategy !== false) {
        allDebts.push(debt);
      } else {
        excludedDebts.push(debt);
      }
    }

    // Add debt bills
    for (const bill of debtBills) {
      const balance = bill.remainingBalance || 0;
      
      // Skip bills with zero balance
      if (balance <= 0) continue;

      const debt: UnifiedDebtInput = {
        id: bill.id,
        name: bill.name,
        remainingBalance: balance,
        minimumPayment: bill.minimumPayment || 0,
        additionalMonthlyPayment: bill.budgetedMonthlyPayment
          ? Math.max(0, bill.budgetedMonthlyPayment - (bill.minimumPayment || 0))
          : 0,
        interestRate: bill.billInterestRate || 0,
        type: bill.debtType || 'other',
        loanType: 'installment', // All debt bills are installment loans (credit cards are accounts)
        compoundingFrequency: (bill.interestType as 'daily' | 'monthly' | 'quarterly' | 'annually') || 'monthly',
        billingCycleDays: 30,
        color: bill.billColor || undefined,
        source: 'bill',
        sourceType: bill.debtType || 'other',
      };

      if (inStrategyOnly && !bill.includeInPayoffStrategy) {
        excludedDebts.push(debt);
      } else if (bill.includeInPayoffStrategy !== false) {
        allDebts.push(debt);
      } else {
        excludedDebts.push(debt);
      }
    }

    if (allDebts.length === 0) {
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
    const debtInputs: DebtInput[] = allDebts.map(({ source, sourceType, ...rest }) => rest);

    if (compare) {
      const comparison = comparePayoffMethods(debtInputs, effectiveExtraPayment, paymentFrequency);
      
      // Enhance payoff order with source info
      const enhancePayoffOrder = (order: typeof comparison.snowball.payoffOrder) => {
        return order.map(item => {
          const sourceDebt = allDebts.find(d => d.id === item.debtId);
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
        const sourceDebt = allDebts.find(d => d.id === item.debtId);
        return {
          ...item,
          source: sourceDebt?.source || 'bill',
          sourceType: sourceDebt?.sourceType || 'other',
        };
      });

      // Enhance rolldown payments with source info
      const enhancedRolldownPayments = strategy.rolldownPayments.map(item => {
        const sourceDebt = allDebts.find(d => d.id === item.debtId);
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
