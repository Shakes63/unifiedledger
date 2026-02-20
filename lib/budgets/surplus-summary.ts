import Decimal from 'decimal.js';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { budgetCategories, debtSettings, debts, transactions } from '@/lib/db/schema';
import { getMonthRangeForDate } from '@/lib/utils/local-date';

export interface BudgetSurplusSummary {
  monthlyIncome: number;
  totalBudgetedExpenses: number;
  totalActualExpenses: number;
  totalMinimumPayments: number;
  currentExtraPayment: number;
  budgetedSurplus: number;
  availableToApply: number;
  totalDebtPayments: number;
  debtToIncomeRatio: number;
  debtToIncomeLevel: 'healthy' | 'manageable' | 'high';
  hasSurplus: boolean;
  suggestedExtraPayment: number;
  hasDebts: boolean;
  hasIncome: boolean;
  hasBudgets: boolean;
}

interface CalculateBudgetSurplusSummaryParams {
  userId: string;
  householdId: string;
  asOfDate?: Date;
}

export async function calculateBudgetSurplusSummary({
  userId,
  householdId,
  asOfDate = new Date(),
}: CalculateBudgetSurplusSummaryParams): Promise<BudgetSurplusSummary> {
  const { startDate: monthStart, endDate: monthEnd } = getMonthRangeForDate(asOfDate);

  const incomeResult = await db
    .select({ totalCents: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId),
        eq(transactions.type, 'income'),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd)
      )
    );

  const monthlyIncome = new Decimal(incomeResult[0]?.totalCents ?? 0).div(100).toNumber();

  const budgetCategoriesResult = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId),
        eq(budgetCategories.isActive, true)
      )
    );

  const totalBudgetedExpenses = budgetCategoriesResult
    .filter((category) => category.type === 'expense')
    .reduce(
      (runningTotal, category) =>
        new Decimal(runningTotal).plus(category.monthlyBudget || 0).toNumber(),
      0
    );

  const expensesResult = await db
    .select({ totalCents: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd)
      )
    );

  const totalActualExpenses = new Decimal(expensesResult[0]?.totalCents ?? 0).div(100).toNumber();

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

  const totalMinimumPayments = activeDebts.reduce(
    (runningTotal, debt) => new Decimal(runningTotal).plus(debt.minimumPayment || 0).toNumber(),
    0
  );

  const settings = await db
    .select()
    .from(debtSettings)
    .where(and(eq(debtSettings.userId, userId), eq(debtSettings.householdId, householdId)))
    .limit(1);

  const currentExtraPayment = settings[0]?.extraMonthlyPayment || 0;

  const budgetedSurplus = new Decimal(monthlyIncome)
    .minus(totalBudgetedExpenses)
    .minus(totalMinimumPayments)
    .minus(currentExtraPayment)
    .toNumber();

  const availableToApply = new Decimal(monthlyIncome)
    .minus(totalActualExpenses)
    .minus(totalMinimumPayments)
    .toNumber();

  const totalDebtPayments = new Decimal(totalMinimumPayments)
    .plus(currentExtraPayment)
    .toNumber();

  const debtToIncomeRatio = monthlyIncome > 0
    ? new Decimal(totalDebtPayments).div(monthlyIncome).times(100).toNumber()
    : 0;

  let debtToIncomeLevel: 'healthy' | 'manageable' | 'high';
  if (debtToIncomeRatio < 20) {
    debtToIncomeLevel = 'healthy';
  } else if (debtToIncomeRatio < 35) {
    debtToIncomeLevel = 'manageable';
  } else {
    debtToIncomeLevel = 'high';
  }

  const suggestedExtraPayment = availableToApply > 0
    ? Math.floor(availableToApply * 0.8)
    : 0;

  return {
    monthlyIncome,
    totalBudgetedExpenses,
    totalActualExpenses,
    totalMinimumPayments,
    currentExtraPayment,
    budgetedSurplus,
    availableToApply,
    totalDebtPayments,
    debtToIncomeRatio: Math.round(debtToIncomeRatio * 10) / 10,
    debtToIncomeLevel,
    hasSurplus: availableToApply > 0,
    suggestedExtraPayment,
    hasDebts: activeDebts.length > 0,
    hasIncome: monthlyIncome > 0,
    hasBudgets: budgetCategoriesResult.length > 0,
  };
}
