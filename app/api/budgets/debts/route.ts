import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtSettings, debtPayments } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { calculatePayoffStrategy, type DebtInput, type PaymentFrequency, type PayoffMethod } from '@/lib/debts/payoff-calculator';
import Decimal from 'decimal.js';

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
    const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];

    // Fetch active debts
    const activeDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
          eq(debts.householdId, householdId),
          eq(debts.status, 'active')
        )
      );

    // If no active debts, return empty response
    if (activeDebts.length === 0) {
      return Response.json({
        debts: [],
        totalMinimumPayments: 0,
        totalRecommendedPayments: 0,
        totalActualPaid: 0,
        focusDebt: null,
        extraPaymentAmount: 0,
        payoffMethod: 'avalanche' as PayoffMethod,
        paymentFrequency: 'monthly' as PaymentFrequency,
      } satisfies DebtBudgetResponse);
    }

    // Fetch debt settings
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

    const extraPayment = settings.length > 0 ? (settings[0].extraMonthlyPayment || 0) : 0;
    const preferredMethod = (settings.length > 0 ? (settings[0].preferredMethod || 'avalanche') : 'avalanche') as PayoffMethod;
    const paymentFrequency = (settings.length > 0 ? (settings[0].paymentFrequency || 'monthly') : 'monthly') as PaymentFrequency;

    // Transform debts to DebtInput format for calculator
    const debtInputs: DebtInput[] = activeDebts.map(debt => ({
      id: debt.id,
      name: debt.name,
      remainingBalance: debt.remainingBalance,
      minimumPayment: debt.minimumPayment || 0,
      additionalMonthlyPayment: debt.additionalMonthlyPayment || 0,
      interestRate: debt.interestRate || 0,
      type: debt.type || 'other',
      loanType: debt.loanType as 'revolving' | 'installment' | undefined,
      compoundingFrequency: debt.compoundingFrequency as 'daily' | 'monthly' | 'quarterly' | 'annually' | undefined,
      billingCycleDays: debt.billingCycleDays || undefined,
      color: debt.color || undefined,
      icon: debt.icon || undefined,
    }));

    // Calculate payoff strategy
    const strategy = calculatePayoffStrategy(debtInputs, extraPayment, preferredMethod, paymentFrequency);

    // Fetch actual payments for each debt this month
    const debtPaymentData = await db
      .select()
      .from(debtPayments)
      .where(
        and(
          eq(debtPayments.userId, userId),
          eq(debtPayments.householdId, householdId),
          gte(debtPayments.paymentDate, monthStart),
          lte(debtPayments.paymentDate, monthEnd)
        )
      );

    // Create a map of debt payments by debt ID
    const paymentsByDebt = new Map<string, number>();
    for (const payment of debtPaymentData) {
      const current = paymentsByDebt.get(payment.debtId) || 0;
      paymentsByDebt.set(payment.debtId, new Decimal(current).plus(payment.amount).toNumber());
    }

    // Find the focus debt ID from the strategy
    const focusDebtId = strategy.nextRecommendedPayment.debtId;

    // Build the debt budget items
    const debtBudgetItems: DebtBudgetItem[] = activeDebts.map(debt => {
      const isFocusDebt = debt.id === focusDebtId;
      const minimumPayment = debt.minimumPayment || 0;
      const additionalMonthly = debt.additionalMonthlyPayment || 0;
      const actualPaid = paymentsByDebt.get(debt.id) || 0;

      // Get rolldown payment info for this debt
      const rolldownInfo = strategy.rolldownPayments?.find(r => r.debtId === debt.id);

      // Calculate recommended payment
      // For focus debt: use the full recommended payment from strategy
      // For other debts: use minimum + additional monthly commitment
      let recommendedPayment: number;
      if (isFocusDebt) {
        recommendedPayment = strategy.nextRecommendedPayment.recommendedPayment;
      } else {
        recommendedPayment = minimumPayment + additionalMonthly;
      }

      return {
        debtId: debt.id,
        debtName: debt.name,
        creditorName: debt.creditorName,
        minimumPayment,
        additionalMonthlyPayment: additionalMonthly,
        recommendedPayment,
        isFocusDebt,
        actualPaid,
        remainingBalance: debt.remainingBalance,
        interestRate: debt.interestRate || 0,
        payoffMonth: rolldownInfo?.payoffMonth || 0,
        payoffDate: rolldownInfo?.payoffDate || strategy.debtFreeDate.toISOString(),
        color: debt.color || '#ef4444',
        type: debt.type || 'other',
      };
    });

    // Sort: focus debt first, then by recommended payment descending
    debtBudgetItems.sort((a, b) => {
      if (a.isFocusDebt) return -1;
      if (b.isFocusDebt) return 1;
      return b.recommendedPayment - a.recommendedPayment;
    });

    // Calculate totals
    const totalMinimumPayments = debtBudgetItems.reduce(
      (sum, d) => new Decimal(sum).plus(d.minimumPayment).toNumber(),
      0
    );

    const totalRecommendedPayments = debtBudgetItems.reduce(
      (sum, d) => new Decimal(sum).plus(d.recommendedPayment).toNumber(),
      0
    );

    const totalActualPaid = debtBudgetItems.reduce(
      (sum, d) => new Decimal(sum).plus(d.actualPaid).toNumber(),
      0
    );

    const focusDebt = debtBudgetItems.find(d => d.isFocusDebt) || null;

    return Response.json({
      debts: debtBudgetItems,
      totalMinimumPayments,
      totalRecommendedPayments,
      totalActualPaid,
      focusDebt,
      extraPaymentAmount: extraPayment,
      payoffMethod: preferredMethod,
      paymentFrequency,
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

