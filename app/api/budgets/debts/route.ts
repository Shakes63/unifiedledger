import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { getMonthRangeForYearMonth } from '@/lib/utils/local-date';
import type { PaymentFrequency, PayoffMethod } from '@/lib/debts/payoff-calculator';
import { getUnifiedDebtBudget } from '@/lib/debts/debt-budget-service';

export const dynamic = 'force-dynamic';

interface DebtBudgetItem {
  debtId: string;
  debtName: string;
  creditorName: string;
  minimumPayment: number;
  additionalMonthlyPayment: number;
  recommendedPayment: number;
  isFocusDebt: boolean;
  actualPaid: number;
  remainingBalance: number;
  interestRate: number;
  payoffMonth: number;
  payoffDate: string;
  color: string;
  type: string;
}

interface DebtBudgetResponse {
  debts: DebtBudgetItem[];
  totalMinimumPayments: number;
  totalRecommendedPayments: number;
  totalActualPaid: number;
  focusDebt: DebtBudgetItem | null;
  extraPaymentAmount: number;
  payoffMethod: PayoffMethod;
  paymentFrequency: PaymentFrequency;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get month parameter from query string (default to current month)
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');

    let year: number;
    let month: number;

    if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-');
      year = parseInt(yearStr);
      month = parseInt(monthStr);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    // Calculate month start and end dates
    const { startDate: monthStart, endDate: monthEnd } = getMonthRangeForYearMonth(year, month);

    const unified = await getUnifiedDebtBudget({
      householdId,
      monthStart,
      monthEnd,
    });

    const allDebts = [...unified.strategyDebts.items, ...unified.manualDebts];

    if (allDebts.length === 0) {
      return Response.json({
        debts: [],
        totalMinimumPayments: 0,
        totalRecommendedPayments: 0,
        totalActualPaid: 0,
        focusDebt: null,
        extraPaymentAmount: 0,
        payoffMethod: unified.payoffMethod,
        paymentFrequency: unified.paymentFrequency,
      } satisfies DebtBudgetResponse);
    }
    const debtBudgetItems: DebtBudgetItem[] = allDebts.map((debt) => {
      const recommendedPayment =
        unified.strategyEnabled && debt.includeInPayoffStrategy
          ? debt.recommendedPayment
          : debt.budgetedPayment ?? debt.minimumPayment;
      const additionalMonthlyPayment = Math.max(
        0,
        recommendedPayment - debt.minimumPayment
      );

      return {
        debtId: debt.id,
        debtName: debt.name,
        creditorName:
          debt.source === 'account' ? 'Credit Account' : 'Debt Bill',
        minimumPayment: debt.minimumPayment,
        additionalMonthlyPayment,
        recommendedPayment,
        isFocusDebt:
          unified.strategyEnabled &&
          debt.includeInPayoffStrategy &&
          debt.isFocusDebt,
        actualPaid: debt.actualPaid,
        remainingBalance: debt.balance,
        interestRate: debt.interestRate || 0,
        payoffMonth: 0,
        payoffDate: '',
        color: debt.color || '#ef4444',
        type: debt.sourceType || 'other',
      };
    });

    debtBudgetItems.sort((a, b) => {
      if (a.isFocusDebt) return -1;
      if (b.isFocusDebt) return 1;
      return b.recommendedPayment - a.recommendedPayment;
    });

    const focusDebt = debtBudgetItems.find((d) => d.isFocusDebt) || null;

    return Response.json({
      debts: debtBudgetItems,
      totalMinimumPayments: unified.totalMinimumPayments,
      totalRecommendedPayments: unified.totalBudgetedPayments,
      totalActualPaid: unified.totalActualPaid,
      focusDebt,
      extraPaymentAmount: unified.extraMonthlyPayment,
      payoffMethod: unified.payoffMethod as PayoffMethod,
      paymentFrequency: unified.paymentFrequency as PaymentFrequency,
    } satisfies DebtBudgetResponse);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Debt budget error:', error);
    return Response.json(
      { error: 'Failed to fetch debt budget data' },
      { status: 500 }
    );
  }
}
