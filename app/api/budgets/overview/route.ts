import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, budgetCategories, bills, billInstances } from '@/lib/db/schema';
import { eq, and, gte, lte, sum } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface CategoryBudgetStatus {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'savings';
  monthlyBudget: number;
  actualSpent: number;
  remaining: number;
  percentage: number;
  status: 'on_track' | 'warning' | 'exceeded' | 'unbudgeted';
  dailyAverage: number;
  budgetedDailyAverage: number;
  projectedMonthEnd: number;
  isOverBudget: boolean;
  incomeFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'variable';
  shouldShowDailyAverage: boolean;
  // Rollover fields (Phase 17)
  rolloverEnabled: boolean;
  rolloverBalance: number;
  rolloverLimit: number | null;
  effectiveBudget: number; // monthlyBudget + rolloverBalance (for expense categories)
}

/**
 * Calculate expected income and projection based on frequency
 */
function calculateIncomeProjection(
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'variable' | null | undefined,
  monthlyBudget: number,
  actualReceived: number,
  daysElapsed: number,
  daysRemaining: number
): {
  projectedMonthEnd: number;
  shouldShowDailyAverage: boolean;
} {
  // Default to variable if not specified
  if (!frequency || frequency === 'variable') {
    // Use existing daily average logic
    const dailyAvg = daysElapsed > 0 ? new Decimal(actualReceived).div(daysElapsed).toNumber() : 0;
    const projection = daysRemaining > 0
      ? new Decimal(actualReceived).plus(new Decimal(dailyAvg).times(daysRemaining)).toNumber()
      : actualReceived;

    return {
      projectedMonthEnd: projection,
      shouldShowDailyAverage: true,
    };
  }

  // For frequency-based income (weekly, biweekly, monthly):
  // Project the full budget amount since income frequency is predictable
  return {
    projectedMonthEnd: monthlyBudget,
    shouldShowDailyAverage: false,
  };
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get month parameter from query string (default to current month)
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');

    let year: number;
    let month: number;

    if (monthParam) {
      // Parse month from YYYY-MM format
      const [yearStr, monthStr] = monthParam.split('-');
      year = parseInt(yearStr);
      month = parseInt(monthStr);
    } else {
      // Default to current month
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1; // JavaScript months are 0-indexed
    }

    // Calculate month start and end dates
    const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];
    const daysInMonth = new Date(year, month, 0).getDate();

    // Calculate days elapsed and remaining
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStartDate = new Date(year, month - 1, 1);
    const monthEndDate = new Date(year, month, 0);

    let daysElapsed = 0;
    let daysRemaining = daysInMonth;

    // Only calculate elapsed/remaining if viewing current month
    if (year === now.getFullYear() && month === now.getMonth() + 1) {
      daysElapsed = Math.max(1, now.getDate()); // At least 1 day elapsed
      daysRemaining = Math.max(0, daysInMonth - now.getDate());
    } else if (currentDate > monthEndDate) {
      // Past month - all days elapsed
      daysElapsed = daysInMonth;
      daysRemaining = 0;
    } else if (currentDate < monthStartDate) {
      // Future month - no days elapsed
      daysElapsed = 0;
      daysRemaining = daysInMonth;
    }

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

    // Calculate actual spending for each category
    const categoryStatuses: CategoryBudgetStatus[] = [];

    for (const category of categories) {
      const monthlyBudget = category.monthlyBudget || 0;
      const rolloverEnabled = category.rolloverEnabled || false;
      const rolloverBalance = category.rolloverBalance || 0;
      const rolloverLimit = category.rolloverLimit;

      // Calculate effective budget (base + positive rollover for expense categories)
      // Only positive rollover adds to effective budget to avoid showing negative budgets
      const effectiveBudget = category.type === 'expense' && rolloverEnabled && rolloverBalance > 0
        ? new Decimal(monthlyBudget).plus(rolloverBalance).toNumber()
        : monthlyBudget;

      // Get actual spending/income for this category in this month
      const spendingResult = await db
        .select({ total: sum(transactions.amount) })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId),
            eq(transactions.categoryId, category.id),
            eq(transactions.type, category.type === 'income' ? 'income' : 'expense'),
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd)
          )
        );

      const actualSpent = spendingResult[0]?.total
        ? new Decimal(spendingResult[0].total.toString()).toNumber()
        : 0;

      // Use effective budget for remaining calculation when rollover is enabled
      const budgetForCalculation = rolloverEnabled && category.type === 'expense' ? effectiveBudget : monthlyBudget;
      const remaining = new Decimal(budgetForCalculation).minus(actualSpent).toNumber();
      const percentage = budgetForCalculation > 0
        ? new Decimal(actualSpent).div(budgetForCalculation).times(100).toNumber()
        : 0;

      // Calculate daily averages (use effective budget for expense categories with rollover)
      const dailyAverage = daysElapsed > 0
        ? new Decimal(actualSpent).div(daysElapsed).toNumber()
        : 0;

      const budgetedDailyAverage = daysInMonth > 0
        ? new Decimal(budgetForCalculation).div(daysInMonth).toNumber()
        : 0;

      // Calculate projection based on category type and income frequency
      let projectedMonthEnd = actualSpent;
      let shouldShowDailyAverage = true;

      if (category.type === 'income') {
        // Use frequency-based projection for income
        const projection = calculateIncomeProjection(
          category.incomeFrequency as any,
          monthlyBudget,
          actualSpent,
          daysElapsed,
          daysRemaining
        );
        projectedMonthEnd = projection.projectedMonthEnd;
        shouldShowDailyAverage = projection.shouldShowDailyAverage;
      } else {
        // For expenses: use daily average projection
        projectedMonthEnd = daysElapsed > 0 && daysRemaining > 0
          ? new Decimal(actualSpent)
              .plus(new Decimal(dailyAverage).times(daysRemaining))
              .toNumber()
          : actualSpent;
        shouldShowDailyAverage = true;
      }

      // Determine status (logic differs for income vs expenses)
      let status: 'on_track' | 'warning' | 'exceeded' | 'unbudgeted' = 'unbudgeted';

      if (budgetForCalculation > 0) {
        if (category.type === 'income') {
          // For income: exceeding budget is good, falling short is bad
          if (percentage >= 100) {
            status = 'exceeded'; // Will be shown as green (good - extra income!)
          } else if (percentage >= 80) {
            status = 'on_track'; // Close to target
          } else if (percentage >= 50) {
            status = 'warning'; // Income shortfall warning
          } else {
            // Severe income shortfall - reuse 'exceeded' but components will show red
            status = 'exceeded';
          }
        } else {
          // For expenses/savings: check if at or under effective budget (includes rollover)
          // Use small tolerance for floating point comparison (within $0.01)
          const isAtBudget = Math.abs(remaining) < 0.01;
          const isOverBudgetCheck = remaining < -0.01; // More than 1 cent over

          if (isOverBudgetCheck) {
            status = 'exceeded'; // Over budget (bad)
          } else if (isAtBudget) {
            status = 'on_track'; // At budget (right on target)
          } else if (percentage >= 80) {
            status = 'warning'; // Close to limit
          } else {
            status = 'on_track'; // Under budget (good)
          }
        }
      }

      // Use effective budget to determine if over budget
      const isOverBudget = actualSpent > budgetForCalculation && budgetForCalculation > 0;

      categoryStatuses.push({
        id: category.id,
        name: category.name,
        type: category.type,
        monthlyBudget,
        actualSpent,
        remaining,
        percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
        status,
        dailyAverage,
        budgetedDailyAverage,
        projectedMonthEnd,
        isOverBudget,
        incomeFrequency: category.type === 'income' ? (category.incomeFrequency || undefined) : undefined,
        shouldShowDailyAverage,
        // Rollover fields (Phase 17)
        rolloverEnabled,
        rolloverBalance,
        rolloverLimit,
        effectiveBudget,
      });
    }

    // Calculate summary statistics
    const incomeCategories = categoryStatuses.filter(c => c.type === 'income');
    const expenseCategories = categoryStatuses.filter(c => c.type === 'expense');
    const savingsCategories = categoryStatuses.filter(c => c.type === 'savings');

    const totalIncome = incomeCategories.reduce(
      (sum, c) => new Decimal(sum).plus(c.monthlyBudget).toNumber(),
      0
    );

    const totalIncomeActual = incomeCategories.reduce(
      (sum, c) => new Decimal(sum).plus(c.actualSpent).toNumber(),
      0
    );

    const totalExpenseBudget = expenseCategories.reduce(
      (sum, c) => new Decimal(sum).plus(c.monthlyBudget).toNumber(),
      0
    );

    const totalExpenseActual = expenseCategories.reduce(
      (sum, c) => new Decimal(sum).plus(c.actualSpent).toNumber(),
      0
    );

    const totalSavingsBudget = savingsCategories.reduce(
      (sum, c) => new Decimal(sum).plus(c.monthlyBudget).toNumber(),
      0
    );

    const totalSavingsActual = savingsCategories.reduce(
      (sum, c) => new Decimal(sum).plus(c.actualSpent).toNumber(),
      0
    );

    const budgetedSurplus = new Decimal(totalIncome)
      .minus(totalExpenseBudget)
      .minus(totalSavingsBudget)
      .toNumber();

    const actualSurplus = new Decimal(totalIncomeActual)
      .minus(totalExpenseActual)
      .minus(totalSavingsActual)
      .toNumber();

    // Calculate adherence score (0-100)
    // Average of all category scores (categories with budgets)
    const categoriesWithBudgets = categoryStatuses.filter(c => c.monthlyBudget > 0);

    let adherenceScore = 100;

    if (categoriesWithBudgets.length > 0) {
      let totalScore = 0;

      for (const category of categoriesWithBudgets) {
        if (category.type === 'income') {
          // For income: meeting or exceeding budget is good
          if (category.actualSpent >= category.monthlyBudget) {
            // At or above income target = 100 points
            totalScore += 100;
          } else {
            // Below income target = penalize based on shortfall percentage
            const shortfallPercent = new Decimal(category.monthlyBudget)
              .minus(category.actualSpent)
              .div(category.monthlyBudget)
              .times(100)
              .toNumber();

            const score = Math.max(0, 100 - shortfallPercent);
            totalScore += score;
          }
        } else {
          // For expenses/savings: original logic
          if (category.actualSpent <= category.monthlyBudget) {
            // Under or on budget = 100 points
            totalScore += 100;
          } else {
            // Over budget = penalize based on overage percentage
            const overagePercent = new Decimal(category.actualSpent)
              .minus(category.monthlyBudget)
              .div(category.monthlyBudget)
              .times(100)
              .toNumber();

            const score = Math.max(0, 100 - overagePercent);
            totalScore += score;
          }
        }
      }

      adherenceScore = Math.round(totalScore / categoriesWithBudgets.length);
    }

    // ========== Recurring Income from Bills ==========
    // Get income bills for the current household
    const incomeBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.householdId, householdId),
          eq(bills.billType, 'income'),
          eq(bills.isActive, true)
        )
      );

    // Get bill instances for income bills in this month
    const incomeBillIds = incomeBills.map(b => b.id);
    let incomeInstances: {
      id: string;
      billId: string;
      dueDate: string;
      expectedAmount: number;
      status: string | null;
      paidDate: string | null;
    }[] = [];

    if (incomeBillIds.length > 0) {
      const instances = await db
        .select({
          id: billInstances.id,
          billId: billInstances.billId,
          dueDate: billInstances.dueDate,
          expectedAmount: billInstances.expectedAmount,
          status: billInstances.status,
          paidDate: billInstances.paidDate,
        })
        .from(billInstances)
        .where(
          and(
            eq(billInstances.userId, userId),
            eq(billInstances.householdId, householdId),
            gte(billInstances.dueDate, monthStart),
            lte(billInstances.dueDate, monthEnd)
          )
        );

      // Filter to only income bill instances
      incomeInstances = instances.filter(inst => incomeBillIds.includes(inst.billId));
    }

    // Calculate recurring income stats
    const recurringIncomeExpected = incomeInstances.reduce(
      (sum, inst) => new Decimal(sum).plus(inst.expectedAmount).toNumber(),
      0
    );

    const recurringIncomeReceived = incomeInstances
      .filter(inst => inst.status === 'paid')
      .reduce((sum, inst) => new Decimal(sum).plus(inst.expectedAmount).toNumber(), 0);

    const recurringIncomePending = incomeInstances
      .filter(inst => inst.status === 'pending')
      .reduce((sum, inst) => new Decimal(sum).plus(inst.expectedAmount).toNumber(), 0);

    const recurringIncomeLate = incomeInstances
      .filter(inst => inst.status === 'overdue')
      .reduce((sum, inst) => new Decimal(sum).plus(inst.expectedAmount).toNumber(), 0);

    // Group categories by type for organized display
    const groupedCategories = {
      income: incomeCategories.sort((a, b) => a.name.localeCompare(b.name)),
      expenses: expenseCategories.sort((a, b) => a.name.localeCompare(b.name)),
      savings: savingsCategories.sort((a, b) => a.name.localeCompare(b.name)),
    };

    return Response.json({
      month: `${year}-${String(month).padStart(2, '0')}`,
      summary: {
        totalIncome,
        totalIncomeActual,
        totalExpenseBudget,
        totalExpenseActual,
        totalSavingsBudget,
        totalSavingsActual,
        budgetedSurplus,
        actualSurplus,
        adherenceScore,
        daysInMonth,
        daysRemaining,
        daysElapsed,
        // Recurring income from bills
        recurringIncomeExpected,
        recurringIncomeReceived,
        recurringIncomePending,
        recurringIncomeLate,
        recurringIncomeSourceCount: incomeBills.length,
      },
      categories: categoryStatuses,
      groupedCategories,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Budget overview error:', error);
    return Response.json(
      { error: 'Failed to fetch budget overview' },
      { status: 500 }
    );
  }
}
