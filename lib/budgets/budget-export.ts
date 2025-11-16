import { db } from '@/lib/db';
import { budgetCategories, transactions } from '@/lib/db/schema';
import { eq, and, gte, lte, sum } from 'drizzle-orm';
import Papa from 'papaparse';
import Decimal from 'decimal.js';

export interface BudgetExportOptions {
  startMonth: string; // 'YYYY-MM'
  endMonth: string; // 'YYYY-MM'
  includeSummary?: boolean;
  includeVariableBills?: boolean;
  categoryTypes?: Array<'income' | 'variable_expense' | 'monthly_bill' | 'savings' | 'debt' | 'non_monthly_bill'>;
}

export interface BudgetExportRow {
  Month: string;
  Category: string;
  Type: string;
  Budgeted: string;
  Actual: string;
  Remaining: string;
  Percentage: string;
  Status: string;
  Daily_Avg: string;
  Projected_Month_End: string;
}

interface CategoryBudgetData {
  id: string;
  name: string;
  type: string;
  monthlyBudget: number;
  actualSpent: number;
  remaining: number;
  percentage: number;
  status: string;
  dailyAverage: number;
  projectedMonthEnd: number;
}

/**
 * Get budget data for a specific month
 */
async function getBudgetDataForMonth(
  userId: string,
  householdId: string,
  year: number,
  month: number,
  categoryTypes?: Array<string>
): Promise<CategoryBudgetData[]> {
  // Get month boundaries
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];

  // Calculate days elapsed in month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const isCurrentMonth = year === currentYear && month === currentMonth;
  const daysElapsed = isCurrentMonth ? currentDay : daysInMonth;

  // Get all budget categories for this user and household
  let query = db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId),
        eq(budgetCategories.isActive, true)
      )
    );

  const categories = await query;

  // Filter by category types if specified
  const filteredCategories = categoryTypes && categoryTypes.length > 0
    ? categories.filter(c => categoryTypes.includes(c.type))
    : categories;

  const categoryData: CategoryBudgetData[] = [];

  for (const category of filteredCategories) {
    // Calculate actual spending/income from transactions
    // Query the correct transaction type based on category type
    const transactionType = category.type === 'income' ? 'income' : 'expense';

    const categoryTransactions = await db
      .select({
        total: sum(transactions.amount),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId),
          eq(transactions.categoryId, category.id),
          eq(transactions.type, transactionType),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd)
        )
      );

    const actualSpent = categoryTransactions[0]?.total
      ? Math.abs(Number(categoryTransactions[0].total))
      : 0;

    const monthlyBudget = category.monthlyBudget || 0;

    // Calculate remaining based on category type
    // Income: positive if over target (extra income), negative if short
    // Expense: positive if under budget (money saved), negative if over
    const remaining = category.type === 'income'
      ? actualSpent - monthlyBudget
      : monthlyBudget - actualSpent;

    const percentage = monthlyBudget > 0 ? (actualSpent / monthlyBudget) * 100 : 0;

    // Determine status based on category type (logic differs for income vs expenses)
    let status: string;
    if (monthlyBudget === 0) {
      status = 'Unbudgeted';
    } else {
      if (category.type === 'income') {
        // For income: exceeding budget is good, falling short is bad
        if (percentage >= 100) {
          status = 'Met Target'; // Meeting or exceeding income target
        } else if (percentage >= 80) {
          status = 'On Track'; // Close to target
        } else if (percentage >= 50) {
          status = 'Below Target'; // Income shortfall
        } else {
          status = 'Severe Shortfall'; // Critical income shortfall
        }
      } else {
        // For expenses: original logic (exceeding is bad)
        if (percentage >= 100) {
          status = 'Exceeded'; // Over budget
        } else if (percentage >= 80) {
          status = 'Warning'; // Close to limit
        } else {
          status = 'On Track'; // Under budget
        }
      }
    }

    const dailyAverage = daysElapsed > 0 ? actualSpent / daysElapsed : 0;
    const projectedMonthEnd = dailyAverage * daysInMonth;

    categoryData.push({
      id: category.id,
      name: category.name,
      type: category.type,
      monthlyBudget,
      actualSpent,
      remaining,
      percentage,
      status,
      dailyAverage,
      projectedMonthEnd,
    });
  }

  return categoryData;
}

/**
 * Format status label for CSV
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'on_track':
      return 'On Track';
    case 'warning':
      return 'Warning';
    case 'exceeded':
      return 'Exceeded';
    case 'unbudgeted':
      return 'Unbudgeted';
    default:
      return status;
  }
}

/**
 * Format category type for display
 */
function formatCategoryType(type: string): string {
  switch (type) {
    case 'income':
      return 'Income';
    case 'variable_expense':
      return 'Variable Expense';
    case 'monthly_bill':
      return 'Monthly Bill';
    case 'non_monthly_bill':
      return 'Non-Monthly Bill';
    case 'savings':
      return 'Savings';
    case 'debt':
      return 'Debt';
    default:
      return type;
  }
}

/**
 * Generate CSV data from budget export data
 */
export function generateBudgetCSV(
  data: Array<{
    month: string;
    categories: CategoryBudgetData[];
  }>,
  options: BudgetExportOptions
): string {
  const rows: BudgetExportRow[] = [];

  // Add data rows
  for (const monthData of data) {
    for (const category of monthData.categories) {
      rows.push({
        Month: monthData.month,
        Category: category.name,
        Type: formatCategoryType(category.type),
        Budgeted: category.monthlyBudget.toFixed(2),
        Actual: category.actualSpent.toFixed(2),
        Remaining: category.remaining.toFixed(2),
        Percentage: category.percentage.toFixed(2) + '%',
        Status: category.status,
        Daily_Avg: category.dailyAverage.toFixed(2),
        Projected_Month_End: category.projectedMonthEnd.toFixed(2),
      });
    }
  }

  // Add summary row if requested
  if (options.includeSummary) {
    const totalBudgeted = data.reduce(
      (sum, monthData) =>
        sum + monthData.categories.reduce((s, c) => s + c.monthlyBudget, 0),
      0
    );
    const totalActual = data.reduce(
      (sum, monthData) =>
        sum + monthData.categories.reduce((s, c) => s + c.actualSpent, 0),
      0
    );

    // Sum pre-calculated remaining values (already accounts for income/expense logic)
    const totalRemaining = data.reduce(
      (sum, monthData) =>
        sum + monthData.categories.reduce((s, c) => s + c.remaining, 0),
      0
    );

    const totalPercentage = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;

    rows.push({
      Month: 'TOTAL',
      Category: 'All Categories',
      Type: 'Summary',
      Budgeted: totalBudgeted.toFixed(2),
      Actual: totalActual.toFixed(2),
      Remaining: totalRemaining.toFixed(2),
      Percentage: totalPercentage.toFixed(2) + '%',
      Status: totalPercentage >= 100 ? 'Exceeded' : 'On Track',
      Daily_Avg: '',
      Projected_Month_End: '',
    });
  }

  // Generate CSV using PapaParse
  const csv = Papa.unparse({
    fields: [
      'Month',
      'Category',
      'Type',
      'Budgeted',
      'Actual',
      'Remaining',
      'Percentage',
      'Status',
      'Daily_Avg',
      'Projected_Month_End',
    ],
    data: rows.map((row) => [
      row.Month,
      row.Category,
      row.Type,
      row.Budgeted,
      row.Actual,
      row.Remaining,
      row.Percentage,
      row.Status,
      row.Daily_Avg,
      row.Projected_Month_End,
    ]),
  });

  return csv;
}

/**
 * Export budget data to CSV
 */
export async function exportBudgetToCSV(
  userId: string,
  householdId: string,
  options: BudgetExportOptions
): Promise<string> {
  try {
    // Validate date range
    const startDate = new Date(options.startMonth + '-01');
    const endDate = new Date(options.endMonth + '-01');

    if (startDate > endDate) {
      throw new Error('Start month cannot be after end month');
    }

    // Calculate month difference (max 12 months)
    const monthDiff =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    if (monthDiff > 11) {
      throw new Error('Cannot export more than 12 months at a time');
    }

    // Collect data for each month
    const monthlyData: Array<{
      month: string;
      categories: CategoryBudgetData[];
    }> = [];

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const monthString = `${year}-${month.toString().padStart(2, '0')}`;

      const categories = await getBudgetDataForMonth(
        userId,
        householdId,
        year,
        month,
        options.categoryTypes
      );

      monthlyData.push({
        month: monthString,
        categories,
      });

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Generate CSV
    const csv = generateBudgetCSV(monthlyData, options);

    return csv;
  } catch (error) {
    console.error('Error exporting budget to CSV:', error);
    throw error;
  }
}

/**
 * Generate filename for budget export
 */
export function generateExportFilename(options: BudgetExportOptions): string {
  const { startMonth, endMonth } = options;

  if (startMonth === endMonth) {
    return `budget-export-${startMonth}.csv`;
  } else {
    return `budget-export-${startMonth}-to-${endMonth}.csv`;
  }
}
