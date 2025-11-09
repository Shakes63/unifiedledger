import Decimal from 'decimal.js';

export type PayoffMethod = 'snowball' | 'avalanche';

export interface DebtInput {
  id: string;
  name: string;
  remainingBalance: number;
  minimumPayment: number;
  interestRate: number;
  type: string;
  loanType?: 'revolving' | 'installment';
  compoundingFrequency?: 'daily' | 'monthly' | 'quarterly' | 'annually';
  billingCycleDays?: number;
  color?: string;
  icon?: string;
}

export interface MonthlyPayment {
  debtId: string;
  debtName: string;
  paymentAmount: number;
  principalAmount: number;
  interestAmount: number;
  remainingBalance: number;
}

export interface DebtPayoffSchedule {
  debtId: string;
  debtName: string;
  originalBalance: number;
  paymentAmount: number;
  monthsToPayoff: number;
  totalInterestPaid: number;
  payoffDate: Date;
  monthlyBreakdown: MonthlyPayment[];
}

export interface PayoffOrder {
  debtId: string;
  debtName: string;
  remainingBalance: number;
  interestRate: number;
  minimumPayment: number;
  order: number;
  type: string;
  color?: string;
  icon?: string;
}

export interface PayoffStrategyResult {
  method: PayoffMethod;
  totalMonths: number;
  totalInterestPaid: number;
  debtFreeDate: Date;
  payoffOrder: PayoffOrder[];
  nextRecommendedPayment: {
    debtId: string;
    debtName: string;
    currentBalance: number;
    recommendedPayment: number;
    monthsUntilPayoff: number;
    totalInterest: number;
  };
  schedules: DebtPayoffSchedule[];
}

export interface ComparisonResult {
  snowball: PayoffStrategyResult;
  avalanche: PayoffStrategyResult;
  timeSavings: number; // months
  interestSavings: number; // dollars
  recommendedMethod: PayoffMethod;
}

/**
 * Calculate monthly interest amount for a debt using appropriate method
 */
function calculateMonthlyInterest(
  balance: Decimal,
  annualRate: number,
  loanType: 'revolving' | 'installment' = 'revolving',
  compoundingFrequency: 'daily' | 'monthly' | 'quarterly' | 'annually' = 'monthly',
  billingCycleDays: number = 30
): Decimal {
  if (annualRate === 0) return new Decimal(0);

  const rate = new Decimal(annualRate).dividedBy(100);

  if (loanType === 'installment') {
    // Installment loans always use simple monthly interest
    const monthlyRate = rate.dividedBy(12);
    return balance.times(monthlyRate);
  }

  // Revolving credit: use appropriate compounding frequency
  switch (compoundingFrequency) {
    case 'daily':
      const dailyRate = rate.dividedBy(365);
      return balance.times(dailyRate).times(billingCycleDays);

    case 'quarterly':
      const quarterlyRate = rate.dividedBy(4);
      return balance.times(quarterlyRate).dividedBy(3);

    case 'annually':
      return balance.times(rate).dividedBy(12);

    case 'monthly':
    default:
      return balance.times(rate).dividedBy(12);
  }
}

/**
 * Sort debts by Snowball method (smallest balance first)
 */
function sortBySnowball(debts: DebtInput[]): DebtInput[] {
  return [...debts].sort((a, b) => a.remainingBalance - b.remainingBalance);
}

/**
 * Sort debts by Avalanche method (highest interest rate first)
 */
function sortByAvalanche(debts: DebtInput[]): DebtInput[] {
  return [...debts].sort((a, b) => b.interestRate - a.interestRate);
}

/**
 * Calculate payoff schedule for a single debt
 */
function calculateDebtSchedule(
  debt: DebtInput,
  paymentAmount: number,
  startMonth: number
): DebtPayoffSchedule {
  let balance = new Decimal(debt.remainingBalance);
  const monthlyBreakdown: MonthlyPayment[] = [];
  let totalInterestPaid = new Decimal(0);
  let monthsToPayoff = 0;

  while (balance.greaterThan(0) && monthsToPayoff < 1000) { // 1000 month safety limit
    const interestAmount = calculateMonthlyInterest(
      balance,
      debt.interestRate,
      debt.loanType || 'revolving',
      debt.compoundingFrequency || 'monthly',
      debt.billingCycleDays || 30
    );
    let payment = new Decimal(paymentAmount);

    // If payment would overpay, adjust to exact remaining balance + interest
    if (payment.greaterThan(balance.plus(interestAmount))) {
      payment = balance.plus(interestAmount);
    }

    const principalAmount = payment.minus(interestAmount);
    balance = balance.minus(principalAmount);

    // Ensure balance doesn't go negative
    if (balance.lessThan(0)) {
      balance = new Decimal(0);
    }

    totalInterestPaid = totalInterestPaid.plus(interestAmount);
    monthsToPayoff++;

    monthlyBreakdown.push({
      debtId: debt.id,
      debtName: debt.name,
      paymentAmount: payment.toNumber(),
      principalAmount: principalAmount.toNumber(),
      interestAmount: interestAmount.toNumber(),
      remainingBalance: balance.toNumber(),
    });

    if (balance.equals(0)) break;
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + startMonth + monthsToPayoff);

  return {
    debtId: debt.id,
    debtName: debt.name,
    originalBalance: debt.remainingBalance,
    paymentAmount,
    monthsToPayoff,
    totalInterestPaid: totalInterestPaid.toNumber(),
    payoffDate,
    monthlyBreakdown,
  };
}

/**
 * Calculate payoff strategy for all debts using specified method
 */
export function calculatePayoffStrategy(
  debts: DebtInput[],
  extraPayment: number,
  method: PayoffMethod
): PayoffStrategyResult {
  if (debts.length === 0) {
    const now = new Date();
    return {
      method,
      totalMonths: 0,
      totalInterestPaid: 0,
      debtFreeDate: now,
      payoffOrder: [],
      nextRecommendedPayment: {
        debtId: '',
        debtName: '',
        currentBalance: 0,
        recommendedPayment: 0,
        monthsUntilPayoff: 0,
        totalInterest: 0,
      },
      schedules: [],
    };
  }

  // Sort debts by chosen method
  const sortedDebts = method === 'snowball'
    ? sortBySnowball(debts)
    : sortByAvalanche(debts);

  // Create payoff order
  const payoffOrder: PayoffOrder[] = sortedDebts.map((debt, index) => ({
    debtId: debt.id,
    debtName: debt.name,
    remainingBalance: debt.remainingBalance,
    interestRate: debt.interestRate,
    minimumPayment: debt.minimumPayment,
    order: index + 1,
    type: debt.type,
    color: debt.color,
    icon: debt.icon,
  }));

  // Calculate total available for extra payments
  const totalMinimums = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
  const totalAvailable = totalMinimums + extraPayment;

  // Calculate schedules using debt avalanche payment strategy
  const schedules: DebtPayoffSchedule[] = [];
  let currentMonth = 0;
  let remainingDebts = [...sortedDebts];
  let availablePayment = totalAvailable;

  while (remainingDebts.length > 0) {
    // Pay minimums on all debts except the first
    const minimumPayments = remainingDebts.slice(1).reduce((sum, d) => sum + d.minimumPayment, 0);

    // All extra goes to first debt in order
    const firstDebtPayment = availablePayment - minimumPayments;

    // Calculate schedule for first debt
    const schedule = calculateDebtSchedule(
      remainingDebts[0],
      firstDebtPayment,
      currentMonth
    );

    schedules.push(schedule);
    currentMonth += schedule.monthsToPayoff;

    // Remove paid-off debt from the list
    const paidOffDebt = remainingDebts[0];
    remainingDebts = remainingDebts.slice(1);

    // Add the paid-off debt's minimum payment to the available pool
    // This is the core of snowball/avalanche - when one debt is paid off,
    // its minimum payment rolls over to help pay the next debt faster
    availablePayment = availablePayment + paidOffDebt.minimumPayment;
  }

  // Calculate totals
  const totalMonths = schedules.reduce((max, s) => Math.max(max, s.monthsToPayoff), 0);
  const totalInterestPaid = schedules.reduce((sum, s) => sum + s.totalInterestPaid, 0);

  const debtFreeDate = new Date();
  debtFreeDate.setMonth(debtFreeDate.getMonth() + currentMonth);

  // Next recommended payment is the first debt in order
  const nextDebt = sortedDebts[0];
  const nextSchedule = schedules[0];

  return {
    method,
    totalMonths: currentMonth,
    totalInterestPaid,
    debtFreeDate,
    payoffOrder,
    nextRecommendedPayment: {
      debtId: nextDebt.id,
      debtName: nextDebt.name,
      currentBalance: nextDebt.remainingBalance,
      recommendedPayment: totalAvailable - debts.slice(1).reduce((sum, d) => sum + d.minimumPayment, 0),
      monthsUntilPayoff: nextSchedule.monthsToPayoff,
      totalInterest: nextSchedule.totalInterestPaid,
    },
    schedules,
  };
}

/**
 * Compare Snowball vs Avalanche methods and recommend the best
 */
export function comparePayoffMethods(
  debts: DebtInput[],
  extraPayment: number
): ComparisonResult {
  const snowball = calculatePayoffStrategy(debts, extraPayment, 'snowball');
  const avalanche = calculatePayoffStrategy(debts, extraPayment, 'avalanche');

  const timeSavings = snowball.totalMonths - avalanche.totalMonths;
  const interestSavings = snowball.totalInterestPaid - avalanche.totalInterestPaid;

  // Recommend avalanche if it saves money or time, otherwise snowball for psychological wins
  const recommendedMethod = (interestSavings > 0 || timeSavings > 0) ? 'avalanche' : 'snowball';

  return {
    snowball,
    avalanche,
    timeSavings,
    interestSavings,
    recommendedMethod,
  };
}
