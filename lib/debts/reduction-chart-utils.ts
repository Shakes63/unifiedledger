import Decimal from 'decimal.js';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths } from 'date-fns';

export interface DebtWithPayments {
  id: string;
  name: string;
  originalAmount: number;
  remainingBalance: number;
  startDate: string;
  status: string;
  minimumPayment?: number;
  interestRate?: number;
  loanType?: string;
  compoundingFrequency?: string;
  payments: Array<{
    paymentDate: string;
    principalAmount: number;
  }>;
}

export interface ChartDataPoint {
  month: string;
  monthDate: Date;
  projectedTotal: number;
  actualTotal: number;
  byDebt: Record<string, number>;
}

export interface DebtDetail {
  id: string;
  name: string;
  originalBalance: number;
  currentBalance: number;
  payoffDate: string | null;
  color: string;
}

export interface ChartSummary {
  totalOriginalDebt: number;
  totalCurrentDebt: number;
  totalPaid: number;
  percentageComplete: number;
  debtFreeDate: string | null;
}

/**
 * Calculate the balance for a debt at a specific date based on payment history
 */
export function calculateBalanceAtDate(
  debt: DebtWithPayments,
  targetDate: Date
): number {
  const originalBalance = new Decimal(debt.originalAmount);

  // Sum all principal payments made on or before target date
  const paidPrincipal = debt.payments
    .filter(p => new Date(p.paymentDate) <= targetDate)
    .reduce((sum, p) => sum.plus(new Decimal(p.principalAmount)), new Decimal(0));

  const balance = originalBalance.minus(paidPrincipal);
  return Math.max(0, balance.toNumber()); // Don't go below zero
}

/**
 * Calculate historical monthly balances for a debt
 * Returns array of months with ending balance for each month
 */
export function calculateHistoricalBalances(
  debt: DebtWithPayments,
  fromDate: Date,
  toDate: Date
): Array<{ month: string; monthDate: Date; balance: number }> {
  const months = eachMonthOfInterval(
    { start: fromDate, end: toDate },
    { step: 1 }
  );

  return months.map(monthDate => ({
    month: format(monthDate, 'yyyy-MM'),
    monthDate,
    balance: calculateBalanceAtDate(debt, endOfMonth(monthDate)),
  }));
}

/**
 * Combine historical balances across all debts by month
 */
export function aggregateHistoricalBalances(
  debts: DebtWithPayments[],
  fromDate: Date,
  toDate: Date
): ChartDataPoint[] {
  // Get all months in the range
  const months = eachMonthOfInterval({ start: fromDate, end: toDate });

  return months.map(monthDate => {
    const month = format(monthDate, 'yyyy-MM');
    const byDebt: Record<string, number> = {};
    let totalBalance = 0;

    // Calculate balance for each debt at end of this month
    for (const debt of debts) {
      const balance = calculateBalanceAtDate(debt, endOfMonth(monthDate));
      byDebt[debt.id] = balance;
      totalBalance += balance;
    }

    return {
      month,
      monthDate,
      projectedTotal: 0, // Will be filled by projection
      actualTotal: totalBalance,
      byDebt,
    };
  });
}

/**
 * Generate projected monthly balances using the existing payoff calculator
 * This properly accounts for interest, minimum payments, and payment strategies
 */
export async function generateProjection(
  debts: DebtWithPayments[],
  fromDate: Date,
  months: number,
  extraMonthlyPayment: number = 0,
  method: 'snowball' | 'avalanche' = 'avalanche',
  paymentFrequency: 'monthly' | 'biweekly' = 'monthly'
): Promise<Array<{ month: string; monthDate: Date; totalDebt: number; byDebt: Record<string, number> }>> {
  // If no debts, return empty projection
  if (debts.length === 0) {
    return [];
  }

  // Import the payoff calculator
  const { calculatePayoffStrategy } = await import('./payoff-calculator');

  // Convert debts to the format expected by the calculator
  const debtInputs = debts.map(debt => ({
    id: debt.id,
    name: debt.name,
    remainingBalance: debt.remainingBalance,
    minimumPayment: debt.minimumPayment || 0,
    interestRate: debt.interestRate || 0,
    type: debt.loanType || 'other', // Type string for debt type
    loanType: (debt.loanType as 'revolving' | 'installment') || 'installment',
    compoundingFrequency: (debt.compoundingFrequency as 'daily' | 'monthly' | 'quarterly' | 'annually') || 'monthly',
  }));

  try {
    // Calculate the payoff strategy using the real calculator
    const strategy = calculatePayoffStrategy(
      debtInputs,
      extraMonthlyPayment,
      method,
      paymentFrequency
    );

    // Create a map of debt schedules for easy lookup
    const scheduleMap = new Map<string, typeof strategy.schedules[0]>();
    strategy.schedules.forEach(schedule => {
      scheduleMap.set(schedule.debtId, schedule);
    });

    // Extract month-by-month projections from the monthly breakdowns
    const projections: Array<{ month: string; monthDate: Date; totalDebt: number; byDebt: Record<string, number> }> = [];

    // Build projection month by month
    const maxMonths = Math.min(months, strategy.totalMonths + 1);

    for (let i = 0; i < maxMonths; i++) {
      const monthDate = addMonths(fromDate, i);
      const month = format(monthDate, 'yyyy-MM');

      // Calculate total debt for this month using actual monthly breakdown
      let totalDebt = 0;
      const byDebt: Record<string, number> = {};

      // Get balance for each debt at this month
      for (const debt of debts) {
        const schedule = scheduleMap.get(debt.id);

        if (!schedule) {
          // If no schedule, assume already paid off or no data
          byDebt[debt.id] = 0;
          continue;
        }

        // Get the balance from the monthly breakdown
        if (i < schedule.monthlyBreakdown.length) {
          const monthData = schedule.monthlyBreakdown[i];
          byDebt[debt.id] = monthData.remainingBalance;
          totalDebt += monthData.remainingBalance;
        } else {
          // Past the end of this debt's schedule, it's paid off
          byDebt[debt.id] = 0;
        }
      }

      projections.push({
        month,
        monthDate,
        totalDebt: Math.round(totalDebt * 100) / 100, // Round to cents
        byDebt: Object.entries(byDebt).reduce(
          (acc, [id, balance]) => ({
            ...acc,
            [id]: Math.round(balance * 100) / 100,
          }),
          {} as Record<string, number>
        ),
      });
    }

    return projections;
  } catch (error) {
    console.error('Error generating projection:', error);
    // Fallback to simple linear projection if calculator fails
    return generateSimpleProjection(debts, fromDate, months, extraMonthlyPayment);
  }
}

/**
 * Fallback: Simple linear projection when the payoff calculator isn't available
 * Note: This doesn't account for interest and is only used as a fallback
 */
function generateSimpleProjection(
  debts: DebtWithPayments[],
  fromDate: Date,
  months: number,
  extraMonthlyPayment: number = 0
): Array<{ month: string; monthDate: Date; totalDebt: number; byDebt: Record<string, number> }> {
  const totalCurrentDebt = debts.reduce((sum, d) => sum + d.remainingBalance, 0);

  // Estimate total monthly payment (this is still approximate)
  const monthlyPayment = extraMonthlyPayment > 0 ? extraMonthlyPayment : totalCurrentDebt / 60; // Assume 5 years if no extra
  const monthsToPayoff = monthlyPayment > 0 ? Math.ceil(totalCurrentDebt / monthlyPayment) : months;

  const projections = [];

  for (let i = 0; i < months; i++) {
    const monthDate = addMonths(fromDate, i);
    const month = format(monthDate, 'yyyy-MM');

    let totalDebt = totalCurrentDebt;
    const byDebt: Record<string, number> = {};

    if (monthlyPayment > 0 && i < monthsToPayoff) {
      // Linear reduction
      const remainingDebt = Math.max(0, totalCurrentDebt - (monthlyPayment * (i + 1)));
      totalDebt = remainingDebt;

      // Distribute proportionally to debts
      debts.forEach(debt => {
        const proportion = debt.remainingBalance / totalCurrentDebt;
        byDebt[debt.id] = remainingDebt * proportion;
      });
    } else if (i >= monthsToPayoff) {
      totalDebt = 0;
      debts.forEach(debt => {
        byDebt[debt.id] = 0;
      });
    }

    projections.push({
      month,
      monthDate,
      totalDebt: Math.max(0, totalDebt),
      byDebt,
    });
  }

  return projections;
}

/**
 * Merge historical and projected data into chart-ready format
 */
export function mergeHistoricalAndProjection(
  historical: ChartDataPoint[],
  projection: Array<{ month: string; monthDate: Date; totalDebt: number; byDebt: Record<string, number> }>
): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];

  // Add historical data
  for (const point of historical) {
    result.push({
      ...point,
      projectedTotal: point.actualTotal, // Match projection to actual in past
    });
  }

  // Add projection data (starting from current month forward)
  const lastHistoricalDate = historical[historical.length - 1]?.monthDate || new Date();

  for (const projectionPoint of projection) {
    // For current and future months, use projection
    if (projectionPoint.monthDate < lastHistoricalDate) {
      continue; // Skip past months that are already in historical
    }

    const existing = result.find(p => p.month === projectionPoint.month);
    if (existing) {
      // Update existing point with projection data
      existing.projectedTotal = projectionPoint.totalDebt;
      // Also update byDebt for future months
      if (projectionPoint.monthDate > lastHistoricalDate) {
        existing.byDebt = { ...existing.byDebt, ...projectionPoint.byDebt };
      }
    } else {
      // Add new projection point
      result.push({
        month: projectionPoint.month,
        monthDate: projectionPoint.monthDate,
        projectedTotal: projectionPoint.totalDebt,
        actualTotal: 0, // No actual data yet for future
        byDebt: projectionPoint.byDebt,
      });
    }
  }

  return result.sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());
}

/**
 * Calculate overall summary statistics
 */
export function calculateSummary(
  debts: DebtWithPayments[],
  chartData: ChartDataPoint[]
): ChartSummary {
  const totalOriginalDebt = debts.reduce((sum, d) => sum + d.originalAmount, 0);
  const totalCurrentDebt = debts.reduce((sum, d) => sum + d.remainingBalance, 0);
  const totalPaid = totalOriginalDebt - totalCurrentDebt;
  const percentageComplete = totalOriginalDebt > 0
    ? (totalPaid / totalOriginalDebt) * 100
    : 0;

  // Find when debts hit zero (from projection)
  let debtFreeDate: string | null = null;
  for (const point of chartData) {
    if (point.projectedTotal <= 0) {
      debtFreeDate = format(point.monthDate, 'yyyy-MM-dd');
      break;
    }
  }

  return {
    totalOriginalDebt: Math.round(totalOriginalDebt * 100) / 100,
    totalCurrentDebt: Math.round(totalCurrentDebt * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    percentageComplete: Math.round(percentageComplete * 100) / 100,
    debtFreeDate,
  };
}

/**
 * Get color palette for debts in chart (rotates through theme colors)
 */
export function getDebtChartColors(debtCount: number): string[] {
  const colors = [
    'var(--color-income)',      // turquoise
    'var(--color-expense)',     // pink
    'var(--color-transfer)',    // purple
    'var(--color-primary)',     // pink (primary)
    'var(--color-success)',     // green
    'var(--color-warning)',     // amber
    'var(--color-error)',       // rose
    '#ec4899',                  // fallback pink
    '#3b82f6',                  // fallback blue
    '#8b5cf6',                  // fallback purple
  ];

  const result = [];
  for (let i = 0; i < debtCount; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
}
