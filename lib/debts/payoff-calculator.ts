import Decimal from 'decimal.js';

export type PayoffMethod = 'snowball' | 'avalanche';
export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export interface DebtInput {
  id: string;
  name: string;
  remainingBalance: number;
  minimumPayment: number;
  additionalMonthlyPayment?: number; // Per-debt extra payment commitment
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
  additionalMonthlyPayment?: number;
  plannedPayment: number; // minimum + additional
  order: number;
  type: string;
  color?: string;
  icon?: string;
}

export interface PayoffStrategyResult {
  method: PayoffMethod;
  paymentFrequency: PaymentFrequency;
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
 * Lump sum payment to apply at specific month
 */
export interface LumpSumPayment {
  month: number;        // Which month to apply (1-based)
  amount: number;       // Lump sum amount
  targetDebtId?: string; // Optional: specific debt, otherwise follows strategy
}

/**
 * A what-if scenario configuration
 */
export interface PayoffScenario {
  name: string;
  extraMonthlyPayment: number;
  lumpSumPayments: LumpSumPayment[];
  method: PayoffMethod;
  paymentFrequency?: PaymentFrequency;
}

/**
 * Result for a single scenario
 */
export interface ScenarioResult {
  name: string;
  method: PayoffMethod;
  totalMonths: number;
  totalInterestPaid: number;
  debtFreeDate: Date;
  payoffOrder: PayoffOrder[];
  schedules: DebtPayoffSchedule[];
  savingsVsBaseline: {
    monthsSaved: number;
    interestSaved: number;
  } | null;
}

/**
 * Comparison of multiple scenarios
 */
export interface ScenarioComparisonResult {
  scenarios: ScenarioResult[];
  recommendation: {
    bestForTime: string;      // Scenario name
    bestForMoney: string;     // Scenario name
    mostBalanced: string;     // Scenario name
  };
}

/**
 * Get number of payment periods per year based on frequency
 */
function getPaymentPeriodsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 52;
    case 'biweekly':
      return 26;
    case 'monthly':
      return 12;
    case 'quarterly':
      return 4;
    default:
      return 12;
  }
}

/**
 * Calculate interest amount for a single payment period
 */
function calculateInterestForPeriod(
  balance: Decimal,
  annualRate: number,
  paymentFrequency: PaymentFrequency,
  loanType: 'revolving' | 'installment' = 'revolving',
  compoundingFrequency: 'daily' | 'monthly' | 'quarterly' | 'annually' = 'monthly',
  billingCycleDays: number = 30
): Decimal {
  if (annualRate === 0) return new Decimal(0);

  const rate = new Decimal(annualRate).dividedBy(100);

  // Handle different payment frequencies
  if (paymentFrequency === 'weekly') {
    // Weekly payments: interest for 7-day period
    if (loanType === 'installment') {
      // For installment loans: Annual rate ÷ 52 periods
      const weeklyRate = rate.dividedBy(52);
      return balance.times(weeklyRate);
    } else {
      // For revolving credit: 7 days of interest
      const dailyRate = rate.dividedBy(365);
      return balance.times(dailyRate).times(7);
    }
  }

  if (paymentFrequency === 'biweekly') {
    // Bi-weekly payments: interest for 14-day period
    if (loanType === 'installment') {
      // For installment loans: Annual rate ÷ 26 periods
      const biweeklyRate = rate.dividedBy(26);
      return balance.times(biweeklyRate);
    } else {
      // For revolving credit: 14 days of interest
      const dailyRate = rate.dividedBy(365);
      return balance.times(dailyRate).times(14);
    }
  }

  if (paymentFrequency === 'quarterly') {
    // Quarterly payments: interest for ~91.25 days (365/4)
    if (loanType === 'installment') {
      // For installment loans: Annual rate ÷ 4 periods
      const quarterlyRate = rate.dividedBy(4);
      return balance.times(quarterlyRate);
    } else {
      // For revolving credit: ~91.25 days of interest
      const dailyRate = rate.dividedBy(365);
      return balance.times(dailyRate).times(91.25);
    }
  }

  // Monthly payments: use original monthly interest calculation
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
 * Calculate monthly interest amount for a debt using appropriate method
 * @deprecated Use calculateInterestForPeriod instead
 */
function calculateMonthlyInterest(
  balance: Decimal,
  annualRate: number,
  loanType: 'revolving' | 'installment' = 'revolving',
  compoundingFrequency: 'daily' | 'monthly' | 'quarterly' | 'annually' = 'monthly',
  billingCycleDays: number = 30
): Decimal {
  return calculateInterestForPeriod(
    balance,
    annualRate,
    'monthly',
    loanType,
    compoundingFrequency,
    billingCycleDays
  );
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
 * Calculate payoff schedule for a single debt with optional lump sum payments
 */
function calculateDebtSchedule(
  debt: DebtInput,
  paymentAmount: number,
  startMonth: number,
  paymentFrequency: PaymentFrequency = 'monthly',
  lumpSumPayments: LumpSumPayment[] = []
): DebtPayoffSchedule {
  let balance = new Decimal(debt.remainingBalance);
  const monthlyBreakdown: MonthlyPayment[] = [];
  let totalInterestPaid = new Decimal(0);
  let monthsToPayoff = 0;

  // Filter and sort lump sums for this specific debt (or all if no targetDebtId)
  const relevantLumpSums = lumpSumPayments
    .filter(ls => !ls.targetDebtId || ls.targetDebtId === debt.id)
    .sort((a, b) => a.month - b.month);

  // Track payment periods (26 for biweekly, 12 for monthly per year)
  const periodsPerYear = getPaymentPeriodsPerYear(paymentFrequency);
  let paymentPeriod = 0;

  // Safety limit: max 360 months (30 years) to prevent memory issues
  // For biweekly, this means ~780 payment periods (360 months * 2.17 periods/month)
  const MAX_MONTHS = 360;
  const MAX_PERIODS = paymentFrequency === 'biweekly' ? Math.ceil(MAX_MONTHS * 2.17) : MAX_MONTHS;

  while (balance.greaterThan(0) && paymentPeriod < MAX_PERIODS) {
    paymentPeriod++;

    // Calculate current month based on payment periods
    // For biweekly: every 2 periods ≈ 1 month
    // For monthly: 1 period = 1 month
    const currentMonth = paymentFrequency === 'biweekly'
      ? startMonth + Math.floor(paymentPeriod / 2.17) + 1  // 26 periods ÷ 12 months ≈ 2.17 periods/month
      : startMonth + paymentPeriod;

    const interestAmount = calculateInterestForPeriod(
      balance,
      debt.interestRate,
      paymentFrequency,
      debt.loanType || 'revolving',
      debt.compoundingFrequency || 'monthly',
      debt.billingCycleDays || 30
    );
    let payment = new Decimal(paymentAmount);

    // Check if there's a lump sum payment this month
    const lumpSumThisMonth = relevantLumpSums.find(ls => ls.month === currentMonth);
    if (lumpSumThisMonth) {
      payment = payment.plus(new Decimal(lumpSumThisMonth.amount));
    }

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

    monthlyBreakdown.push({
      debtId: debt.id,
      debtName: debt.name,
      paymentAmount: payment.toNumber(),
      principalAmount: principalAmount.toNumber(),
      interestAmount: interestAmount.toNumber(),
      remainingBalance: balance.toNumber(),
    });

    if (balance.equals(0)) break;

    // Additional safety: if principal is not reducing balance, something is wrong
    if (principalAmount.lessThanOrEqualTo(0) && paymentPeriod > 1) {
      console.warn(`Payment not reducing balance for debt: ${debt.name}. Payment: ${payment.toNumber()}, Interest: ${interestAmount.toNumber()}`);
      break; // Prevent infinite loop if payment <= interest
    }
  }

  // Convert payment periods to months
  // For biweekly: 26 periods ≈ 12 months (26 ÷ 2.17 ≈ 12)
  // For monthly: periods = months
  monthsToPayoff = paymentFrequency === 'biweekly'
    ? Math.ceil(paymentPeriod / 2.17)
    : paymentPeriod;

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
  method: PayoffMethod,
  paymentFrequency: PaymentFrequency = 'monthly',
  lumpSumPayments: LumpSumPayment[] = []
): PayoffStrategyResult {
  if (debts.length === 0) {
    const now = new Date();
    return {
      method,
      paymentFrequency,
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
    additionalMonthlyPayment: debt.additionalMonthlyPayment,
    plannedPayment: (debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0),
    order: index + 1,
    type: debt.type,
    color: debt.color,
    icon: debt.icon,
  }));

  // Calculate total available for extra payments
  // IMPORTANT: Default to 0 if minimumPayment is null/undefined to prevent NaN
  // Include per-debt additional payments as part of the planned payment
  const totalMinimums = debts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
  const totalPerDebtExtras = debts.reduce((sum, d) => sum + (d.additionalMonthlyPayment || 0), 0);
  const totalAvailable = totalMinimums + totalPerDebtExtras + extraPayment;

  // For biweekly payments, divide monthly amounts by 2
  const paymentDivisor = paymentFrequency === 'biweekly' ? 2 : 1;

  // Calculate schedules using debt avalanche payment strategy
  const schedules: DebtPayoffSchedule[] = [];
  let currentMonth = 0;
  // Include per-debt additional payment as part of the effective minimum
  // This ensures each debt's committed extra is used in projections
  let remainingDebts = [...sortedDebts].map(debt => ({
    ...debt,
    // Effective payment = minimum + per-debt additional
    minimumPayment: ((debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0)) / paymentDivisor,
  }));
  let availablePayment = totalAvailable / paymentDivisor;

  while (remainingDebts.length > 0) {
    // Pay minimums on all debts except the first
    const minimumPayments = remainingDebts.slice(1).reduce((sum, d) => sum + d.minimumPayment, 0);

    // All extra goes to first debt in order
    const firstDebtPayment = availablePayment - minimumPayments;

    // Calculate schedule for first debt
    const schedule = calculateDebtSchedule(
      remainingDebts[0],
      firstDebtPayment,
      currentMonth,
      paymentFrequency,
      lumpSumPayments
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

  // For recommended payment, use the per-period amount (already divided for biweekly)
  const recommendedPayment = availablePayment - remainingDebts.slice(1).reduce((sum, d) => sum + d.minimumPayment, 0);

  return {
    method,
    paymentFrequency,
    totalMonths: currentMonth,
    totalInterestPaid,
    debtFreeDate,
    payoffOrder,
    nextRecommendedPayment: {
      debtId: nextDebt.id,
      debtName: nextDebt.name,
      currentBalance: nextDebt.remainingBalance,
      recommendedPayment: availablePayment - remainingDebts.slice(1).reduce((sum, d) => sum + d.minimumPayment, 0),
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
  extraPayment: number,
  paymentFrequency: PaymentFrequency = 'monthly'
): ComparisonResult {
  const snowball = calculatePayoffStrategy(debts, extraPayment, 'snowball', paymentFrequency);
  const avalanche = calculatePayoffStrategy(debts, extraPayment, 'avalanche', paymentFrequency);

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

/**
 * Calculate and compare multiple what-if scenarios
 */
export function calculateScenarioComparison(
  debts: DebtInput[],
  scenarios: PayoffScenario[]
): ScenarioComparisonResult {
  if (scenarios.length === 0) {
    return {
      scenarios: [],
      recommendation: {
        bestForTime: '',
        bestForMoney: '',
        mostBalanced: '',
      },
    };
  }

  // Calculate results for each scenario
  const results: ScenarioResult[] = [];
  let baselineMonths = 0;
  let baselineInterest = 0;

  scenarios.forEach((scenario, index) => {
    const strategy = calculatePayoffStrategy(
      debts,
      scenario.extraMonthlyPayment,
      scenario.method,
      scenario.paymentFrequency || 'monthly',
      scenario.lumpSumPayments
    );

    // First scenario is baseline
    if (index === 0) {
      baselineMonths = strategy.totalMonths;
      baselineInterest = strategy.totalInterestPaid;
    }

    results.push({
      name: scenario.name,
      method: scenario.method,
      totalMonths: strategy.totalMonths,
      totalInterestPaid: strategy.totalInterestPaid,
      debtFreeDate: strategy.debtFreeDate,
      payoffOrder: strategy.payoffOrder,
      schedules: strategy.schedules,
      savingsVsBaseline: index === 0 ? null : {
        monthsSaved: baselineMonths - strategy.totalMonths,
        interestSaved: baselineInterest - strategy.totalInterestPaid,
      },
    });
  });

  // Find best scenarios
  const sortedByTime = [...results].sort((a, b) => a.totalMonths - b.totalMonths);
  const sortedByMoney = [...results].sort((a, b) => a.totalInterestPaid - b.totalInterestPaid);

  // Most balanced: best combination of time and money savings
  const scoredResults = results.map(r => {
    const timeSaving = baselineMonths - r.totalMonths;
    const moneySaving = baselineInterest - r.totalInterestPaid;
    // Normalize and combine (50% weight each)
    const timeScore = baselineMonths > 0 ? timeSaving / baselineMonths : 0;
    const moneyScore = baselineInterest > 0 ? moneySaving / baselineInterest : 0;
    return {
      name: r.name,
      score: (timeScore + moneyScore) / 2,
    };
  });
  const mostBalanced = scoredResults.sort((a, b) => b.score - a.score)[0];

  return {
    scenarios: results,
    recommendation: {
      bestForTime: sortedByTime[0].name,
      bestForMoney: sortedByMoney[0].name,
      mostBalanced: mostBalanced.name,
    },
  };
}
