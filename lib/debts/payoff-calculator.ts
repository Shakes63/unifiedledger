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

/**
 * Enhanced payment info showing rolldown progression
 */
export interface RolldownPayment {
  debtId: string;
  order: number;
  debtName: string;
  remainingBalance: number;
  interestRate: number;
  minimumPayment: number;
  additionalMonthlyPayment: number;
  /** What they currently pay (minimum + per-debt additional) before becoming focus */
  currentPayment: number;
  /** Payment when this debt becomes the focus (includes extra + rolldown) */
  activePayment: number;
  /** Amount rolled from previously paid debts */
  rolldownAmount: number;
  /** Month number when this debt will be paid off */
  payoffMonth: number;
  /** Actual date when this debt will be paid off */
  payoffDate: Date;
  /** Is this the current priority debt receiving extra payments? */
  isFocusDebt: boolean;
  /** Names of debts whose payments roll into this one */
  rolldownSources: string[];
  /** Months to payoff with ONLY minimum payments (no strategy, no extra) */
  minimumOnlyMonths: number;
  /** Interest paid if only paying minimum */
  minimumOnlyInterest: number;
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
  /** Enhanced payoff order with rolldown visualization data */
  rolldownPayments: RolldownPayment[];
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

// @deprecated: calculateMonthlyInterest - use calculateInterestForPeriod instead
// Kept for reference but removed to eliminate unused function warning

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
 * Get the focus debt ID based on the payoff method
 * This is the debt that should receive extra payments according to the strategy
 * - Avalanche: highest interest rate first
 * - Snowball: smallest balance first
 */
export function getMethodBasedFocusDebtId(debts: DebtInput[], method: PayoffMethod): string {
  if (debts.length === 0) return '';
  
  if (method === 'snowball') {
    // Smallest balance first
    const sorted = sortBySnowball(debts);
    return sorted[0].id;
  } else {
    // Highest interest rate first (avalanche)
    const sorted = sortByAvalanche(debts);
    return sorted[0].id;
  }
}

/**
 * Internal state for tracking a debt during parallel simulation
 */
interface DebtSimulationState {
  debt: DebtInput;
  balance: Decimal;
  totalInterestPaid: Decimal;
  monthlyBreakdown: MonthlyPayment[];
  paidOffAtPeriod: number | null;
  effectiveMinimum: number; // minimum + per-debt additional
}

/**
 * Get the focus debt based on method (the debt receiving extra payments)
 * For snowball: smallest remaining balance
 * For avalanche: highest interest rate
 */
function getFocusDebtIndex(debts: DebtSimulationState[], method: PayoffMethod): number {
  if (debts.length === 0) return -1;
  
  if (method === 'snowball') {
    // Find debt with smallest balance
    let minIdx = 0;
    let minBalance = debts[0].balance;
    for (let i = 1; i < debts.length; i++) {
      if (debts[i].balance.lessThan(minBalance)) {
        minBalance = debts[i].balance;
        minIdx = i;
      }
    }
    return minIdx;
  } else {
    // Find debt with highest interest rate
    let maxIdx = 0;
    let maxRate = debts[0].debt.interestRate;
    for (let i = 1; i < debts.length; i++) {
      if (debts[i].debt.interestRate > maxRate) {
        maxRate = debts[i].debt.interestRate;
        maxIdx = i;
      }
    }
    return maxIdx;
  }
}

/**
 * Simulate all debts in parallel, properly tracking interest on all balances
 * This is the core fix for the bug where snowball and avalanche showed identical interest
 */
function simulatePayoffParallel(
  debts: DebtInput[],
  extraPayment: number,
  method: PayoffMethod,
  paymentFrequency: PaymentFrequency,
  lumpSumPayments: LumpSumPayment[] = []
): {
  totalPeriods: number;
  totalInterest: number;
  schedules: DebtPayoffSchedule[];
  payoffOrder: { debtId: string; order: number }[];
} {
  if (debts.length === 0) {
    return { totalPeriods: 0, totalInterest: 0, schedules: [], payoffOrder: [] };
  }

  const paymentDivisor = paymentFrequency === 'biweekly' ? 2 : 1;
  const periodsPerYear = getPaymentPeriodsPerYear(paymentFrequency);
  
  // Initialize simulation state for all debts
  let activeDebts: DebtSimulationState[] = debts.map(debt => ({
    debt,
    balance: new Decimal(debt.remainingBalance),
    totalInterestPaid: new Decimal(0),
    monthlyBreakdown: [],
    paidOffAtPeriod: null,
    effectiveMinimum: ((debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0)) / paymentDivisor,
  }));

  // Calculate total available payment per period
  // This is the user's total budget: all minimum payments + extra payment
  const totalMinimums = debts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
  const totalPerDebtExtras = debts.reduce((sum, d) => sum + (d.additionalMonthlyPayment || 0), 0);
  let availablePayment = (totalMinimums + totalPerDebtExtras + extraPayment) / paymentDivisor;

  // Track excess payment when focus debt is paid off mid-period with less than allocated
  let excessPayment = new Decimal(0);
  
  const payoffOrder: { debtId: string; order: number }[] = [];
  let payoffCounter = 0;
  let period = 0;

  // Safety limit
  const MAX_PERIODS = paymentFrequency === 'biweekly' ? 780 : 360;

  while (activeDebts.length > 0 && period < MAX_PERIODS) {
    period++;
    
    // Calculate current month for lump sum matching
    const currentMonth = paymentFrequency === 'biweekly'
      ? Math.floor(period / 2.17) + 1
      : period;

    // Find the focus debt for this period
    const focusIdx = getFocusDebtIndex(activeDebts, method);
    
    // Calculate extra available this period:
    // Total budget minus what's needed for minimums on active debts
    // The debt rolldown happens automatically: when a debt is paid off and removed from
    // activeDebts, its minimum is no longer subtracted, so the extra increases
    // Also add any excess from focus debt being paid off with less than its allocation
    let extraThisPeriod = new Decimal(availablePayment)
      .minus(activeDebts.reduce((sum, d) => sum + d.effectiveMinimum, 0))
      .plus(excessPayment);
    
    // Reset excess for this period
    excessPayment = new Decimal(0);

    // Process each active debt
    const debtsToPay: { idx: number; payment: Decimal }[] = [];
    
    for (let i = 0; i < activeDebts.length; i++) {
      const debtState = activeDebts[i];
      const isFocus = i === focusIdx;

      // Calculate interest for this period on current balance
      const interestAmount = calculateInterestForPeriod(
        debtState.balance,
        debtState.debt.interestRate,
        paymentFrequency,
        debtState.debt.loanType || 'revolving',
        debtState.debt.compoundingFrequency || 'monthly',
        debtState.debt.billingCycleDays || 30
      );

      // Determine payment amount
      let payment = new Decimal(debtState.effectiveMinimum);
      
      if (isFocus) {
        payment = payment.plus(extraThisPeriod);
        
        // Check for lump sum payment
        const lumpSum = lumpSumPayments.find(
          ls => ls.month === currentMonth && 
                (!ls.targetDebtId || ls.targetDebtId === debtState.debt.id)
        );
        if (lumpSum) {
          payment = payment.plus(new Decimal(lumpSum.amount));
        }
      }

      // Cap payment at balance + interest
      const maxPayment = debtState.balance.plus(interestAmount);
      if (payment.greaterThan(maxPayment)) {
        // Track excess that couldn't be applied (will roll to next period)
        if (isFocus) {
          excessPayment = excessPayment.plus(payment.minus(maxPayment));
        }
        payment = maxPayment;
      }

      // Calculate principal
      const principalAmount = payment.minus(interestAmount);
      
      // Update state
      debtState.balance = debtState.balance.minus(principalAmount);
      if (debtState.balance.lessThan(0)) {
        debtState.balance = new Decimal(0);
      }
      debtState.totalInterestPaid = debtState.totalInterestPaid.plus(interestAmount);

      // Record payment breakdown
      debtState.monthlyBreakdown.push({
        debtId: debtState.debt.id,
        debtName: debtState.debt.name,
        paymentAmount: payment.toNumber(),
        principalAmount: principalAmount.toNumber(),
        interestAmount: interestAmount.toNumber(),
        remainingBalance: debtState.balance.toNumber(),
      });

      // Check if paid off
      if (debtState.balance.equals(0)) {
        debtState.paidOffAtPeriod = period;
        payoffCounter++;
        payoffOrder.push({ debtId: debtState.debt.id, order: payoffCounter });
        // Note: The debt rolldown happens automatically in the next period because
        // this debt's effectiveMinimum is no longer subtracted from availablePayment
        // when calculating extraThisPeriod (since it's removed from activeDebts)
      }
    }

    // Remove paid-off debts from active list
    activeDebts = activeDebts.filter(d => d.paidOffAtPeriod === null);
  }

  // Build schedules from simulation state
  const allDebtStates = debts.map(debt => {
    const state = activeDebts.find(s => s.debt.id === debt.id) || 
                  { debt, balance: new Decimal(0), totalInterestPaid: new Decimal(0), monthlyBreakdown: [], paidOffAtPeriod: period, effectiveMinimum: 0 };
    
    // Find original state that was processed (may have been removed from activeDebts)
    const originalDebt = debts.find(d => d.id === debt.id)!;
    
    return state;
  });

  // Reconstruct proper state from simulation
  // We need to track all debts that were processed, including paid-off ones
  const debtStateMap = new Map<string, DebtSimulationState>();
  
  // Re-run simulation to collect all states properly
  let simDebts: DebtSimulationState[] = debts.map(debt => ({
    debt,
    balance: new Decimal(debt.remainingBalance),
    totalInterestPaid: new Decimal(0),
    monthlyBreakdown: [],
    paidOffAtPeriod: null,
    effectiveMinimum: ((debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0)) / paymentDivisor,
  }));

  let simPeriod = 0;
  let simExcessPayment = new Decimal(0);
  const simPayoffOrder: { debtId: string; order: number; period: number }[] = [];
  let simPayoffCounter = 0;

  while (simDebts.some(d => d.paidOffAtPeriod === null) && simPeriod < MAX_PERIODS) {
    simPeriod++;
    
    const currentMonth = paymentFrequency === 'biweekly'
      ? Math.floor(simPeriod / 2.17) + 1
      : simPeriod;

    const activeSimDebts = simDebts.filter(d => d.paidOffAtPeriod === null);
    if (activeSimDebts.length === 0) break;

    const focusIdx = getFocusDebtIndex(activeSimDebts, method);
    
    // Calculate extra available this period:
    // Total budget minus minimums of active debts, plus any excess from previous period
    let extraThisPeriod = new Decimal(availablePayment)
      .minus(activeSimDebts.reduce((sum, d) => sum + d.effectiveMinimum, 0))
      .plus(simExcessPayment);
    
    simExcessPayment = new Decimal(0);

    for (let i = 0; i < activeSimDebts.length; i++) {
      const debtState = activeSimDebts[i];
      const isFocus = i === focusIdx;

      const interestAmount = calculateInterestForPeriod(
        debtState.balance,
        debtState.debt.interestRate,
        paymentFrequency,
        debtState.debt.loanType || 'revolving',
        debtState.debt.compoundingFrequency || 'monthly',
        debtState.debt.billingCycleDays || 30
      );

      let payment = new Decimal(debtState.effectiveMinimum);
      
      if (isFocus) {
        payment = payment.plus(extraThisPeriod);
        
        const lumpSum = lumpSumPayments.find(
          ls => ls.month === currentMonth && 
                (!ls.targetDebtId || ls.targetDebtId === debtState.debt.id)
        );
        if (lumpSum) {
          payment = payment.plus(new Decimal(lumpSum.amount));
        }
      }

      const maxPayment = debtState.balance.plus(interestAmount);
      if (payment.greaterThan(maxPayment)) {
        // Track excess when focus debt is capped
        if (isFocus) {
          simExcessPayment = simExcessPayment.plus(payment.minus(maxPayment));
        }
        payment = maxPayment;
      }

      const principalAmount = payment.minus(interestAmount);
      
      debtState.balance = debtState.balance.minus(principalAmount);
      if (debtState.balance.lessThan(0)) {
        debtState.balance = new Decimal(0);
      }
      debtState.totalInterestPaid = debtState.totalInterestPaid.plus(interestAmount);

      debtState.monthlyBreakdown.push({
        debtId: debtState.debt.id,
        debtName: debtState.debt.name,
        paymentAmount: payment.toNumber(),
        principalAmount: principalAmount.toNumber(),
        interestAmount: interestAmount.toNumber(),
        remainingBalance: debtState.balance.toNumber(),
      });

      if (debtState.balance.equals(0) && debtState.paidOffAtPeriod === null) {
        debtState.paidOffAtPeriod = simPeriod;
        simPayoffCounter++;
        simPayoffOrder.push({ debtId: debtState.debt.id, order: simPayoffCounter, period: simPeriod });
        // Note: Debt rolldown happens automatically - this debt's minimum is no longer
        // subtracted in the next period since it's filtered out of activeSimDebts
      }
    }
  }

  // Calculate total interest from all debts
  const totalInterest = simDebts.reduce(
    (sum, d) => sum.plus(d.totalInterestPaid),
    new Decimal(0)
  ).toNumber();

  // Convert periods to months
  const totalMonths = paymentFrequency === 'biweekly'
    ? Math.ceil(simPeriod / 2.17)
    : simPeriod;

  // Build schedules
  const schedules: DebtPayoffSchedule[] = simDebts.map(debtState => {
    const payoffInfo = simPayoffOrder.find(p => p.debtId === debtState.debt.id);
    const periodsToPayoff = payoffInfo ? payoffInfo.period : simPeriod;
    const monthsToPayoff = paymentFrequency === 'biweekly'
      ? Math.ceil(periodsToPayoff / 2.17)
      : periodsToPayoff;

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + monthsToPayoff);

    return {
      debtId: debtState.debt.id,
      debtName: debtState.debt.name,
      originalBalance: debtState.debt.remainingBalance,
      paymentAmount: debtState.effectiveMinimum * paymentDivisor, // Convert back to monthly
      monthsToPayoff,
      totalInterestPaid: debtState.totalInterestPaid.toNumber(),
      payoffDate,
      monthlyBreakdown: debtState.monthlyBreakdown,
    };
  });

  // Sort payoff order by order number
  const sortedPayoffOrder = simPayoffOrder
    .sort((a, b) => a.order - b.order)
    .map(p => ({ debtId: p.debtId, order: p.order }));

  return {
    totalPeriods: simPeriod,
    totalInterest,
    schedules,
    payoffOrder: sortedPayoffOrder,
  };
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
  // Note: periodsPerYear available via getPaymentPeriodsPerYear(paymentFrequency) if needed
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
 * Calculate months to pay off a single debt with only minimum payments
 * Used to show comparison between minimum-only and strategy payoff times
 */
function calculateMinimumOnlyPayoff(
  balance: number,
  minimumPayment: number,
  interestRate: number,
  loanType: 'revolving' | 'installment' = 'revolving'
): { months: number; totalInterest: number } {
  if (balance <= 0 || minimumPayment <= 0) {
    return { months: 0, totalInterest: 0 };
  }

  let currentBalance = new Decimal(balance);
  const monthlyRate = new Decimal(interestRate).dividedBy(100).dividedBy(12);
  let months = 0;
  let totalInterest = new Decimal(0);
  const maxMonths = 600; // 50 years safety limit

  while (currentBalance.greaterThan(0) && months < maxMonths) {
    months++;
    
    // Calculate interest for this month
    let interestAmount: Decimal;
    if (loanType === 'installment') {
      interestAmount = currentBalance.times(monthlyRate);
    } else {
      // Revolving credit - use daily rate approximation
      const dailyRate = new Decimal(interestRate).dividedBy(100).dividedBy(365);
      interestAmount = currentBalance.times(dailyRate).times(30);
    }
    
    totalInterest = totalInterest.plus(interestAmount);
    
    // Calculate payment (capped at balance + interest)
    let payment = new Decimal(minimumPayment);
    const maxPayment = currentBalance.plus(interestAmount);
    if (payment.greaterThan(maxPayment)) {
      payment = maxPayment;
    }
    
    // Calculate principal
    const principal = payment.minus(interestAmount);
    currentBalance = currentBalance.minus(principal);
    
    if (currentBalance.lessThan(0)) {
      currentBalance = new Decimal(0);
    }
    
    // If payment doesn't cover interest, debt will never be paid off
    if (principal.lessThanOrEqualTo(0) && months > 1) {
      return { months: -1, totalInterest: -1 }; // -1 indicates never payoff
    }
  }

  return { 
    months: months >= maxMonths ? -1 : months, 
    totalInterest: totalInterest.toNumber() 
  };
}

/**
 * Calculate rolldown payment progression for visualization
 * Shows how payments change as each debt is paid off
 * @param focusDebtId - The debt that should be marked as focus based on the method
 */
function calculateRolldownPayments(
  debts: DebtInput[],
  extraPayment: number,
  method: PayoffMethod,
  paymentFrequency: PaymentFrequency,
  schedules: DebtPayoffSchedule[],
  payoffOrder: { debtId: string; order: number }[],
  focusDebtId: string
): RolldownPayment[] {
  if (debts.length === 0) return [];

  // Sort debts by the payoff order
  const sortedDebts = [...debts].sort((a, b) => {
    const orderA = payoffOrder.find(p => p.debtId === a.id)?.order ?? 999;
    const orderB = payoffOrder.find(p => p.debtId === b.id)?.order ?? 999;
    return orderA - orderB;
  });

  // Track cumulative rolldown as each debt is paid off
  let cumulativeRolldown = 0;
  const paidOffDebts: string[] = [];

  const rolldownPayments: RolldownPayment[] = sortedDebts.map((debt, index) => {
    const schedule = schedules.find(s => s.debtId === debt.id);
    const order = payoffOrder.find(p => p.debtId === debt.id)?.order ?? index + 1;
    
    // Current payment before becoming focus (just minimum + per-debt additional)
    const currentPayment = (debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0);
    
    // When this debt becomes focus, it gets: its current payment + extra + all rolldown
    const activePayment = currentPayment + extraPayment + cumulativeRolldown;
    
    // Collect rolldown sources (names of debts that rolled into this one)
    const rolldownSources = [...paidOffDebts];
    
    const payoffMonth = schedule?.monthsToPayoff || 0;
    const payoffDate = schedule?.payoffDate || new Date();
    
    // Calculate minimum-only payoff time for comparison
    const minimumOnlyResult = calculateMinimumOnlyPayoff(
      debt.remainingBalance,
      debt.minimumPayment || 0,
      debt.interestRate,
      debt.loanType || 'revolving'
    );
    
    // Mark as focus based on method-determined focus debt ID, not payoff order
    // This ensures avalanche always shows highest interest as focus,
    // and snowball always shows lowest balance as focus
    const isFocusDebt = debt.id === focusDebtId;
    
    // Build the rolldown payment info
    const rolldownPayment: RolldownPayment = {
      debtId: debt.id,
      order,
      debtName: debt.name,
      remainingBalance: debt.remainingBalance,
      interestRate: debt.interestRate,
      minimumPayment: debt.minimumPayment || 0,
      additionalMonthlyPayment: debt.additionalMonthlyPayment || 0,
      currentPayment,
      activePayment,
      rolldownAmount: cumulativeRolldown,
      payoffMonth,
      payoffDate,
      isFocusDebt,
      rolldownSources,
      minimumOnlyMonths: minimumOnlyResult.months,
      minimumOnlyInterest: minimumOnlyResult.totalInterest,
      type: debt.type,
      color: debt.color,
      icon: debt.icon,
    };

    // After this debt is paid off, its payment rolls down to the next debt
    // This includes minimum + per-debt additional (the extra payment stays constant)
    cumulativeRolldown += currentPayment;
    paidOffDebts.push(debt.name);

    return rolldownPayment;
  });

  return rolldownPayments;
}

/**
 * Calculate payoff strategy for all debts using specified method
 * Uses parallel simulation to properly track interest on ALL debts simultaneously
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
      rolldownPayments: [],
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

  // Use parallel simulation for accurate interest calculation
  const simulation = simulatePayoffParallel(
    debts,
    extraPayment,
    method,
    paymentFrequency,
    lumpSumPayments
  );

  // Sort debts by chosen method for initial payoff order display
  const sortedDebts = method === 'snowball'
    ? sortBySnowball(debts)
    : sortByAvalanche(debts);

  // Create payoff order based on simulation results
  const payoffOrder: PayoffOrder[] = sortedDebts.map((debt, index) => {
    // Find actual payoff order from simulation
    const simOrder = simulation.payoffOrder.find(p => p.debtId === debt.id);
    
    return {
      debtId: debt.id,
      debtName: debt.name,
      remainingBalance: debt.remainingBalance,
      interestRate: debt.interestRate,
      minimumPayment: debt.minimumPayment,
      additionalMonthlyPayment: debt.additionalMonthlyPayment,
      plannedPayment: (debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0),
      order: simOrder ? simOrder.order : index + 1,
      type: debt.type,
      color: debt.color,
      icon: debt.icon,
    };
  });

  // Sort payoff order by actual payoff sequence
  payoffOrder.sort((a, b) => a.order - b.order);

  // Calculate total months (use cumulative from simulation)
  const totalMonths = paymentFrequency === 'biweekly'
    ? Math.ceil(simulation.totalPeriods / 2.17)
    : simulation.totalPeriods;

  const debtFreeDate = new Date();
  debtFreeDate.setMonth(debtFreeDate.getMonth() + totalMonths);

  // Determine focus debt based on method (not simulation payoff order)
  // This ensures avalanche always shows highest interest debt as focus,
  // and snowball always shows lowest balance as focus, regardless of extra payment amount
  const focusDebtId = getMethodBasedFocusDebtId(debts, method);
  const focusDebt = debts.find(d => d.id === focusDebtId) || sortedDebts[0];
  const focusSchedule = simulation.schedules.find(s => s.debtId === focusDebtId) || simulation.schedules[0];

  // Calculate recommended payment for focus debt
  const paymentDivisor = paymentFrequency === 'biweekly' ? 2 : 1;
  const totalMinimums = debts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
  const totalPerDebtExtras = debts.reduce((sum, d) => sum + (d.additionalMonthlyPayment || 0), 0);
  const totalAvailable = (totalMinimums + totalPerDebtExtras + extraPayment) / paymentDivisor;
  const otherMinimums = debts
    .filter(d => d.id !== focusDebtId)
    .reduce((sum, d) => sum + ((d.minimumPayment || 0) + (d.additionalMonthlyPayment || 0)) / paymentDivisor, 0);
  const recommendedPaymentAmount = totalAvailable - otherMinimums;

  // Calculate rolldown payments for visualization
  const rolldownPayments = calculateRolldownPayments(
    debts,
    extraPayment,
    method,
    paymentFrequency,
    simulation.schedules,
    simulation.payoffOrder,
    focusDebtId
  );

  return {
    method,
    paymentFrequency,
    totalMonths,
    totalInterestPaid: simulation.totalInterest,
    debtFreeDate,
    payoffOrder,
    rolldownPayments,
    nextRecommendedPayment: {
      debtId: focusDebt?.id || '',
      debtName: focusDebt?.name || '',
      currentBalance: focusDebt?.remainingBalance || 0,
      recommendedPayment: recommendedPaymentAmount,
      monthsUntilPayoff: focusSchedule?.monthsToPayoff || 0,
      totalInterest: focusSchedule?.totalInterestPaid || 0,
    },
    schedules: simulation.schedules,
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
