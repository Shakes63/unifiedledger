import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { 
  transactions, 
  budgetCategories, 
  debts, 
  debtSettings,
  debtPayments 
} from '@/lib/db/schema';
import { eq, and, gte, lte, sum } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface CategoryDetail {
  id: string;
  name: string;
  budgeted: number;
  actual: number;
  percentage: number;
}

interface DebtDetail {
  id: string;
  name: string;
  creditorName: string;
  minimumPayment: number;
  additionalPayment: number;
  actualPaid: number;
  remainingBalance: number;
}

interface AllocationSummary {
  month: string;
  allocations: {
    income: {
      budgeted: number;
      actual: number;
      categories: CategoryDetail[];
    };
    variableExpenses: {
      budgeted: number;
      actual: number;
      categories: CategoryDetail[];
    };
    monthlyBills: {
      budgeted: number;
      actual: number;
      categories: CategoryDetail[];
    };
    nonMonthlyBills: {
      budgeted: number;
      actual: number;
      categories: CategoryDetail[];
    };
    savings: {
      budgeted: number;
      actual: number;
      categories: CategoryDetail[];
    };
    debtPayments: {
      minimumPayments: number;
      extraPayments: number;
      actualPaid: number;
      debts: DebtDetail[];
    };
  };
  summary: {
    totalIncomeBudgeted: number;
    totalIncomeActual: number;
    totalExpensesBudgeted: number;
    totalExpensesActual: number;
    totalSavingsBudgeted: number;
    totalSavingsActual: number;
    totalDebtPaymentsBudgeted: number;
    totalDebtPaymentsActual: number;
    budgetedSurplus: number;
    actualSurplus: number;
    allocationPercentages: {
      variableExpenses: number;
      monthlyBills: number;
      nonMonthlyBills: number;
      savings: number;
      debtPayments: number;
    };
  };
  trends?: {
    months: string[];
    income: number[];
    expenses: number[];
    savings: number[];
    surplus: number[];
  };
}

/**
 * GET /api/budgets/allocation-summary
 * 
 * Returns a comprehensive budget allocation summary including:
 * - Income, expenses, savings, and debt payments by category type
 * - Both budgeted and actual amounts
 * - Allocation percentages relative to income
 * - Optional 6-month trend data
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get month parameter from query string (default to current month)
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');
    const includeTrends = url.searchParams.get('trends') === 'true';

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

    // Fetch all active budget categories for user and household
    const categories = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isActive, true)
        )
      );

    // Helper function to get actual spending for a category
    async function getCategoryActual(categoryId: string, transactionType: 'income' | 'expense'): Promise<number> {
      const result = await db
        .select({ total: sum(transactions.amount) })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId),
            eq(transactions.categoryId, categoryId),
            eq(transactions.type, transactionType),
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd)
          )
        );
      return result[0]?.total 
        ? new Decimal(result[0].total.toString()).toNumber() 
        : 0;
    }

    // Process categories by type
    const incomeCategories = categories.filter(c => c.type === 'income');
    const variableExpenseCategories = categories.filter(c => c.type === 'variable_expense');
    const monthlyBillCategories = categories.filter(c => c.type === 'monthly_bill');
    const nonMonthlyBillCategories = categories.filter(c => c.type === 'non_monthly_bill');
    const savingsCategories = categories.filter(c => c.type === 'savings');

    // Build category details with actuals
    async function buildCategoryDetails(
      cats: typeof categories,
      transactionType: 'income' | 'expense'
    ): Promise<CategoryDetail[]> {
      const details: CategoryDetail[] = [];
      for (const cat of cats) {
        const budgeted = cat.monthlyBudget || 0;
        const actual = await getCategoryActual(cat.id, transactionType);
        const percentage = budgeted > 0 
          ? new Decimal(actual).div(budgeted).times(100).toNumber() 
          : 0;
        details.push({
          id: cat.id,
          name: cat.name,
          budgeted,
          actual,
          percentage: Math.round(percentage * 10) / 10,
        });
      }
      return details;
    }

    // Build all category details
    const incomeDetails = await buildCategoryDetails(incomeCategories, 'income');
    const variableExpenseDetails = await buildCategoryDetails(variableExpenseCategories, 'expense');
    const monthlyBillDetails = await buildCategoryDetails(monthlyBillCategories, 'expense');
    const nonMonthlyBillDetails = await buildCategoryDetails(nonMonthlyBillCategories, 'expense');
    const savingsDetails = await buildCategoryDetails(savingsCategories, 'expense');

    // Calculate totals for each category type
    const sumBudgeted = (details: CategoryDetail[]) => 
      details.reduce((sum, c) => new Decimal(sum).plus(c.budgeted).toNumber(), 0);
    const sumActual = (details: CategoryDetail[]) => 
      details.reduce((sum, c) => new Decimal(sum).plus(c.actual).toNumber(), 0);

    const incomeBudgeted = sumBudgeted(incomeDetails);
    const incomeActual = sumActual(incomeDetails);

    const variableExpensesBudgeted = sumBudgeted(variableExpenseDetails);
    const variableExpensesActual = sumActual(variableExpenseDetails);

    const monthlyBillsBudgeted = sumBudgeted(monthlyBillDetails);
    const monthlyBillsActual = sumActual(monthlyBillDetails);

    const nonMonthlyBillsBudgeted = sumBudgeted(nonMonthlyBillDetails);
    const nonMonthlyBillsActual = sumActual(nonMonthlyBillDetails);

    const savingsBudgeted = sumBudgeted(savingsDetails);
    const savingsActual = sumActual(savingsDetails);

    // Fetch debt data
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

    // Fetch debt settings for extra payment
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

    const extraMonthlyPayment = settings[0]?.extraMonthlyPayment || 0;

    // Build debt details
    const debtDetails: DebtDetail[] = [];
    let totalMinimumPayments = new Decimal(0);
    let totalDebtPaymentsActual = new Decimal(0);

    for (const debt of activeDebts) {
      // Get actual payments made to this debt this month
      const paymentResult = await db
        .select({ total: sum(debtPayments.amount) })
        .from(debtPayments)
        .where(
          and(
            eq(debtPayments.debtId, debt.id),
            eq(debtPayments.userId, userId),
            eq(debtPayments.householdId, householdId),
            gte(debtPayments.paymentDate, monthStart),
            lte(debtPayments.paymentDate, monthEnd)
          )
        );

      const actualPaid = paymentResult[0]?.total 
        ? new Decimal(paymentResult[0].total.toString()).toNumber() 
        : 0;

      const minimumPayment = debt.minimumPayment || 0;
      const additionalPayment = debt.additionalMonthlyPayment || 0;

      totalMinimumPayments = totalMinimumPayments.plus(minimumPayment);
      totalDebtPaymentsActual = totalDebtPaymentsActual.plus(actualPaid);

      debtDetails.push({
        id: debt.id,
        name: debt.name,
        creditorName: debt.creditorName,
        minimumPayment,
        additionalPayment,
        actualPaid,
        remainingBalance: debt.remainingBalance,
      });
    }

    // Calculate total debt payments budgeted
    const totalDebtPaymentsBudgeted = totalMinimumPayments.plus(extraMonthlyPayment).toNumber();

    // Calculate total expenses (all expense types)
    const totalExpensesBudgeted = new Decimal(variableExpensesBudgeted)
      .plus(monthlyBillsBudgeted)
      .plus(nonMonthlyBillsBudgeted)
      .toNumber();

    const totalExpensesActual = new Decimal(variableExpensesActual)
      .plus(monthlyBillsActual)
      .plus(nonMonthlyBillsActual)
      .toNumber();

    // Calculate surplus (Income - Expenses - Savings - Debt Payments)
    const budgetedSurplus = new Decimal(incomeBudgeted)
      .minus(totalExpensesBudgeted)
      .minus(savingsBudgeted)
      .minus(totalDebtPaymentsBudgeted)
      .toNumber();

    const actualSurplus = new Decimal(incomeActual)
      .minus(totalExpensesActual)
      .minus(savingsActual)
      .minus(totalDebtPaymentsActual.toNumber())
      .toNumber();

    // Calculate allocation percentages (as % of budgeted income)
    const calculatePercentage = (amount: number): number => {
      if (incomeBudgeted <= 0) return 0;
      return new Decimal(amount).div(incomeBudgeted).times(100).toNumber();
    };

    const allocationPercentages = {
      variableExpenses: Math.round(calculatePercentage(variableExpensesBudgeted) * 10) / 10,
      monthlyBills: Math.round(calculatePercentage(monthlyBillsBudgeted) * 10) / 10,
      nonMonthlyBills: Math.round(calculatePercentage(nonMonthlyBillsBudgeted) * 10) / 10,
      savings: Math.round(calculatePercentage(savingsBudgeted) * 10) / 10,
      debtPayments: Math.round(calculatePercentage(totalDebtPaymentsBudgeted) * 10) / 10,
    };

    // Build response
    const response: AllocationSummary = {
      month: `${year}-${String(month).padStart(2, '0')}`,
      allocations: {
        income: {
          budgeted: incomeBudgeted,
          actual: incomeActual,
          categories: incomeDetails,
        },
        variableExpenses: {
          budgeted: variableExpensesBudgeted,
          actual: variableExpensesActual,
          categories: variableExpenseDetails,
        },
        monthlyBills: {
          budgeted: monthlyBillsBudgeted,
          actual: monthlyBillsActual,
          categories: monthlyBillDetails,
        },
        nonMonthlyBills: {
          budgeted: nonMonthlyBillsBudgeted,
          actual: nonMonthlyBillsActual,
          categories: nonMonthlyBillDetails,
        },
        savings: {
          budgeted: savingsBudgeted,
          actual: savingsActual,
          categories: savingsDetails,
        },
        debtPayments: {
          minimumPayments: totalMinimumPayments.toNumber(),
          extraPayments: extraMonthlyPayment,
          actualPaid: totalDebtPaymentsActual.toNumber(),
          debts: debtDetails,
        },
      },
      summary: {
        totalIncomeBudgeted: incomeBudgeted,
        totalIncomeActual: incomeActual,
        totalExpensesBudgeted,
        totalExpensesActual,
        totalSavingsBudgeted: savingsBudgeted,
        totalSavingsActual: savingsActual,
        totalDebtPaymentsBudgeted,
        totalDebtPaymentsActual: totalDebtPaymentsActual.toNumber(),
        budgetedSurplus,
        actualSurplus,
        allocationPercentages,
      },
    };

    // Optionally include 6-month trends
    if (includeTrends) {
      const trends = await calculateTrends(userId, householdId, year, month);
      response.trends = trends;
    }

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Allocation summary error:', error);
    return Response.json(
      { error: 'Failed to calculate allocation summary' },
      { status: 500 }
    );
  }
}

/**
 * Calculate 6-month trends for income, expenses, savings, and surplus
 */
async function calculateTrends(
  userId: string, 
  householdId: string, 
  currentYear: number, 
  currentMonth: number
): Promise<{
  months: string[];
  income: number[];
  expenses: number[];
  savings: number[];
  surplus: number[];
}> {
  const months: string[] = [];
  const income: number[] = [];
  const expenses: number[] = [];
  const savings: number[] = [];
  const surplus: number[] = [];

  // Go back 5 months (6 months total including current)
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - 1 - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    
    const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];

    // Get income for month
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

    // Get expenses for month
    const expenseResult = await db
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

    // Get savings (transactions to savings categories)
    const savingsCategories = await db
      .select({ id: budgetCategories.id })
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.type, 'savings')
        )
      );

    let savingsTotal = new Decimal(0);
    for (const cat of savingsCategories) {
      const catResult = await db
        .select({ total: sum(transactions.amount) })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId),
            eq(transactions.categoryId, cat.id),
            eq(transactions.type, 'expense'),
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd)
          )
        );
      if (catResult[0]?.total) {
        savingsTotal = savingsTotal.plus(catResult[0].total.toString());
      }
    }

    const monthIncome = incomeResult[0]?.total 
      ? new Decimal(incomeResult[0].total.toString()).toNumber() 
      : 0;
    const monthExpenses = expenseResult[0]?.total 
      ? new Decimal(expenseResult[0].total.toString()).toNumber() 
      : 0;
    const monthSavings = savingsTotal.toNumber();
    const monthSurplus = new Decimal(monthIncome).minus(monthExpenses).toNumber();

    months.push(monthStr);
    income.push(monthIncome);
    expenses.push(monthExpenses);
    savings.push(monthSavings);
    surplus.push(monthSurplus);
  }

  return { months, income, expenses, savings, surplus };
}

