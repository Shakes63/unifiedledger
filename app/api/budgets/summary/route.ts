import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, budgetCategories, debts, debtSettings } from '@/lib/db/schema';
import { eq, and, gte, lte, sum } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get current month date range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    // 1. Calculate total monthly income from transactions (current month)
    const incomeResult = await db
      .select({ total: sum(transactions.amount) })
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

    const monthlyIncome = incomeResult[0]?.total
      ? new Decimal(incomeResult[0].total.toString()).toNumber()
      : 0;

    // 2. Calculate total budgeted expenses from budget categories
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
      .filter(cat =>
        cat.type === 'variable_expense' ||
        cat.type === 'monthly_bill' ||
        cat.type === 'non_monthly_bill'
      )
      .reduce((sum, cat) => new Decimal(sum).plus(cat.monthlyBudget || 0).toNumber(), 0);

    // 3. Calculate total actual expenses from transactions (current month)
    const expensesResult = await db
      .select({ total: sum(transactions.amount) })
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

    const totalActualExpenses = expensesResult[0]?.total
      ? new Decimal(expensesResult[0].total.toString()).toNumber()
      : 0;

    // 4. Calculate total minimum debt payments from active debts
    // TODO: Add householdId filter when debts table is updated in Phase 3
    const activeDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
          eq(debts.status, 'active')
        )
      );

    const totalMinimumPayments = activeDebts.reduce(
      (sum, debt) => new Decimal(sum).plus(debt.minimumPayment || 0).toNumber(),
      0
    );

    // 5. Get current extra payment from debt settings
    const settings = await db
      .select()
      .from(debtSettings)
      .where(eq(debtSettings.userId, userId))
      .limit(1);

    const currentExtraPayment = settings[0]?.extraMonthlyPayment || 0;

    // 6. Calculate surplus values
    // Budgeted surplus: income - budgeted expenses - minimum payments - current extra payment
    const budgetedSurplus = new Decimal(monthlyIncome)
      .minus(totalBudgetedExpenses)
      .minus(totalMinimumPayments)
      .minus(currentExtraPayment)
      .toNumber();

    // Available to apply: income - actual expenses - minimum payments
    // This shows what's truly available right now (not what should be available)
    const availableToApply = new Decimal(monthlyIncome)
      .minus(totalActualExpenses)
      .minus(totalMinimumPayments)
      .toNumber();

    // Total debt payments (minimums + extra)
    const totalDebtPayments = new Decimal(totalMinimumPayments)
      .plus(currentExtraPayment)
      .toNumber();

    // 7. Calculate debt-to-income ratio
    const debtToIncomeRatio = monthlyIncome > 0
      ? new Decimal(totalDebtPayments).div(monthlyIncome).times(100).toNumber()
      : 0;

    // Determine debt-to-income level
    let debtToIncomeLevel: 'healthy' | 'manageable' | 'high';
    if (debtToIncomeRatio < 20) {
      debtToIncomeLevel = 'healthy';
    } else if (debtToIncomeRatio < 35) {
      debtToIncomeLevel = 'manageable';
    } else {
      debtToIncomeLevel = 'high';
    }

    // Suggested extra payment: use the available amount (what's actually left over)
    // But cap it at a reasonable percentage (e.g., don't suggest all of it, leave some buffer)
    const suggestedExtraPayment = availableToApply > 0
      ? Math.floor(availableToApply * 0.8) // Suggest 80% of available, keep 20% buffer
      : 0;

    return Response.json({
      monthlyIncome,
      totalBudgetedExpenses,
      totalActualExpenses,
      totalMinimumPayments,
      currentExtraPayment,
      budgetedSurplus,
      availableToApply,
      totalDebtPayments,
      debtToIncomeRatio: Math.round(debtToIncomeRatio * 10) / 10, // Round to 1 decimal
      debtToIncomeLevel,
      hasSurplus: availableToApply > 0,
      suggestedExtraPayment,
      hasDebts: activeDebts.length > 0,
      hasIncome: monthlyIncome > 0,
      hasBudgets: budgetCategoriesResult.length > 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Budget summary error:', error);
    return Response.json(
      { error: 'Failed to calculate budget summary' },
      { status: 500 }
    );
  }
}
