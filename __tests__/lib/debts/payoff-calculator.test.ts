import { describe, it, expect } from 'vitest';
import {
  calculatePayoffStrategy,
  comparePayoffMethods,
  getMethodBasedFocusDebtId,
  type DebtInput,
} from '@/lib/debts/payoff-calculator';

function baseDebt(overrides: Partial<DebtInput> = {}): DebtInput {
  return {
    id: 'debt-1',
    name: 'Credit Card A',
    remainingBalance: 5000,
    minimumPayment: 150,
    interestRate: 18,
    type: 'credit_card',
    loanType: 'revolving',
    compoundingFrequency: 'monthly',
    ...overrides,
  };
}

describe('lib/debts/payoff-calculator', () => {
  describe('getMethodBasedFocusDebtId', () => {
    it('snowball focuses on smallest balance', () => {
      const debts = [
        baseDebt({ id: 'd1', remainingBalance: 5000 }),
        baseDebt({ id: 'd2', remainingBalance: 1000 }),
        baseDebt({ id: 'd3', remainingBalance: 3000 }),
      ];
      expect(getMethodBasedFocusDebtId(debts, 'snowball')).toBe('d2');
    });

    it('avalanche focuses on highest interest rate', () => {
      const debts = [
        baseDebt({ id: 'd1', interestRate: 18 }),
        baseDebt({ id: 'd2', interestRate: 24 }),
        baseDebt({ id: 'd3', interestRate: 12 }),
      ];
      expect(getMethodBasedFocusDebtId(debts, 'avalanche')).toBe('d2');
    });

    it('returns empty string for no debts', () => {
      expect(getMethodBasedFocusDebtId([], 'snowball')).toBe('');
    });
  });

  describe('calculatePayoffStrategy', () => {
    it('returns zeroed result for no debts', () => {
      const result = calculatePayoffStrategy([], 0, 'avalanche');
      expect(result.totalMonths).toBe(0);
      expect(result.totalInterestPaid).toBe(0);
      expect(result.schedules.length).toBe(0);
    });

    it('pays off zero-balance debt in 1 period (simulation runs once)', () => {
      const debts = [baseDebt({ remainingBalance: 0 })];
      const result = calculatePayoffStrategy(debts, 0, 'avalanche');
      // The simulator runs at least 1 period before checking balance
      expect(result.totalMonths).toBe(1);
    });

    it('handles 0% interest (all principal)', () => {
      const debts = [baseDebt({ remainingBalance: 1000, minimumPayment: 100, interestRate: 0 })];
      const result = calculatePayoffStrategy(debts, 0, 'avalanche');

      expect(result.totalMonths).toBe(10);
      expect(result.totalInterestPaid).toBe(0);

      // Each payment should be all principal
      for (const payment of result.schedules[0].monthlyBreakdown) {
        expect(payment.interestAmount).toBe(0);
      }
    });

    it('calculates interest accumulation for 18% APR revolving', () => {
      const debts = [baseDebt({
        remainingBalance: 5000,
        minimumPayment: 200,
        interestRate: 18,
        loanType: 'revolving',
      })];
      const result = calculatePayoffStrategy(debts, 0, 'avalanche');

      expect(result.totalMonths).toBeGreaterThan(0);
      expect(result.totalInterestPaid).toBeGreaterThan(0);

      // Verify first month interest: 5000 * 18% / 12 = $75
      const firstMonth = result.schedules[0].monthlyBreakdown[0];
      expect(firstMonth.interestAmount).toBeCloseTo(75, 0);
      expect(firstMonth.principalAmount).toBeCloseTo(125, 0);
    });

    it('calculates installment loan interest correctly', () => {
      const debts = [baseDebt({
        remainingBalance: 10000,
        minimumPayment: 300,
        interestRate: 6,
        loanType: 'installment',
      })];
      const result = calculatePayoffStrategy(debts, 0, 'avalanche');

      // First month: 10000 * 6% / 12 = $50 interest
      const firstMonth = result.schedules[0].monthlyBreakdown[0];
      expect(firstMonth.interestAmount).toBeCloseTo(50, 0);
    });

    it('detects payment < interest scenario (never payoff)', () => {
      // $50 payment on $10000 at 24% APR = $200/month interest
      // Payment doesn't cover interest, balance grows
      const debts = [baseDebt({
        remainingBalance: 10000,
        minimumPayment: 50,
        interestRate: 24,
        loanType: 'revolving',
      })];
      const result = calculatePayoffStrategy(debts, 0, 'avalanche');

      // Payment < interest is flagged as never-payable (bug-hunt finding M1) —
      // the old behavior burned 360 periods and reported the cap as a payoff.
      expect(result.totalMonths).toBe(-1);
      expect(result.hasUnpayableDebts).toBe(true);
    });

    it('handles $0.01 debt', () => {
      const debts = [baseDebt({
        remainingBalance: 0.01,
        minimumPayment: 25,
        interestRate: 18,
      })];
      const result = calculatePayoffStrategy(debts, 0, 'avalanche');
      expect(result.totalMonths).toBeLessThanOrEqual(1);
    });

    it('handles large debt ($1M): beyond the 30-year horizon is flagged, not capped', () => {
      // $1M at 5% with a $5k payment amortizes in ~431 months — past the
      // 30-year simulation horizon. The old code silently reported the 360
      // cap as the payoff.
      const debts = [baseDebt({
        remainingBalance: 1000000,
        minimumPayment: 5000,
        interestRate: 5,
        loanType: 'installment',
      })];
      const result = calculatePayoffStrategy(debts, 0, 'avalanche');

      expect(result.totalMonths).toBe(-1);
      expect(result.hasUnpayableDebts).toBe(true);
      expect(result.totalInterestPaid).toBeGreaterThan(0);

      // A payment that amortizes inside the horizon (~26 years) stays a
      // normal, dated payoff.
      const payable = calculatePayoffStrategy(
        [baseDebt({
          remainingBalance: 1000000,
          minimumPayment: 5800,
          interestRate: 5,
          loanType: 'installment',
        })],
        0,
        'avalanche'
      );
      expect(payable.hasUnpayableDebts).toBe(false);
      expect(payable.totalMonths).toBeGreaterThan(0);
      expect(payable.totalMonths).toBeLessThanOrEqual(360);
    });

    it('final balance is exactly 0 for each schedule', () => {
      const debts = [baseDebt({
        remainingBalance: 3000,
        minimumPayment: 200,
        interestRate: 15,
      })];
      const result = calculatePayoffStrategy(debts, 0, 'avalanche');

      for (const schedule of result.schedules) {
        const lastPayment = schedule.monthlyBreakdown[schedule.monthlyBreakdown.length - 1];
        expect(lastPayment.remainingBalance).toBe(0);
      }
    });

    it('total interest equals sum of monthly interest amounts', () => {
      const debts = [baseDebt({
        remainingBalance: 5000,
        minimumPayment: 200,
        interestRate: 18,
      })];
      const result = calculatePayoffStrategy(debts, 0, 'avalanche');

      const totalFromBreakdown = result.schedules[0].monthlyBreakdown
        .reduce((sum, m) => sum + m.interestAmount, 0);
      expect(result.schedules[0].totalInterestPaid).toBeCloseTo(totalFromBreakdown, 1);
    });
  });

  describe('Snowball vs Avalanche ordering', () => {
    it('snowball orders by smallest balance first', () => {
      const debts = [
        baseDebt({ id: 'd1', name: 'Big', remainingBalance: 10000, interestRate: 5, minimumPayment: 200 }),
        baseDebt({ id: 'd2', name: 'Small', remainingBalance: 500, interestRate: 20, minimumPayment: 50 }),
        baseDebt({ id: 'd3', name: 'Medium', remainingBalance: 3000, interestRate: 15, minimumPayment: 100 }),
      ];
      const result = calculatePayoffStrategy(debts, 100, 'snowball');

      // Small should be paid off first in snowball
      expect(result.payoffOrder[0].debtName).toBe('Small');
    });

    it('avalanche orders by highest interest rate first', () => {
      const debts = [
        baseDebt({ id: 'd1', name: 'Low Rate', remainingBalance: 500, interestRate: 5, minimumPayment: 50 }),
        baseDebt({ id: 'd2', name: 'High Rate', remainingBalance: 10000, interestRate: 24, minimumPayment: 200 }),
        baseDebt({ id: 'd3', name: 'Mid Rate', remainingBalance: 3000, interestRate: 15, minimumPayment: 100 }),
      ];
      const result = calculatePayoffStrategy(debts, 100, 'avalanche');

      // High Rate should be focused first in avalanche
      expect(result.nextRecommendedPayment.debtName).toBe('High Rate');
    });
  });

  describe('comparePayoffMethods', () => {
    it('avalanche saves more interest than snowball for varied rates', () => {
      const debts = [
        baseDebt({ id: 'd1', remainingBalance: 5000, interestRate: 24, minimumPayment: 150 }),
        baseDebt({ id: 'd2', remainingBalance: 2000, interestRate: 6, minimumPayment: 100 }),
      ];
      const comparison = comparePayoffMethods(debts, 100);

      expect(comparison.interestSavings).toBeGreaterThanOrEqual(0);
      // Avalanche should pay less interest when rates vary significantly
      expect(comparison.avalanche.totalInterestPaid).toBeLessThanOrEqual(comparison.snowball.totalInterestPaid);
    });

    it('recommends avalanche when interest savings exist', () => {
      const debts = [
        baseDebt({ id: 'd1', remainingBalance: 10000, interestRate: 24, minimumPayment: 200 }),
        baseDebt({ id: 'd2', remainingBalance: 1000, interestRate: 5, minimumPayment: 50 }),
      ];
      const comparison = comparePayoffMethods(debts, 200);

      if (comparison.interestSavings > 0) {
        expect(comparison.recommendedMethod).toBe('avalanche');
      }
    });
  });

  describe('Payment frequency variations', () => {
    it('biweekly payments reduce debt faster than monthly', () => {
      const debts = [baseDebt({
        remainingBalance: 5000,
        minimumPayment: 200,
        interestRate: 18,
      })];

      const monthly = calculatePayoffStrategy(debts, 0, 'avalanche', 'monthly');
      const biweekly = calculatePayoffStrategy(debts, 0, 'avalanche', 'biweekly');

      // Biweekly makes ~26 payments/year vs 12 monthly, so pays off faster
      expect(biweekly.totalMonths).toBeLessThanOrEqual(monthly.totalMonths);
    });
  });
});

describe('bug-hunt regressions (M1/M3/M5)', () => {
  it('M1: a debt whose minimum does not cover interest is flagged never-payable, not "paid off in 30 years"', () => {
    // $10,000 @ 24% APR -> $200/month interest; the $100 minimum loses ground
    // every month. The old sim burned 360 periods and reported monthsToPayoff
    // 360 with megadollar interest.
    const result = calculatePayoffStrategy(
      [baseDebt({ remainingBalance: 10000, minimumPayment: 100, interestRate: 24 })],
      0,
      'avalanche'
    );
    expect(result.hasUnpayableDebts).toBe(true);
    expect(result.totalMonths).toBe(-1);
    expect(result.schedules[0].paidOff).toBe(false);
    expect(result.schedules[0].monthsToPayoff).toBe(-1);
    // The stall detector stops the sim early instead of compounding for 30
    // simulated years.
    expect(result.schedules[0].monthlyBreakdown.length).toBeLessThan(24);
  });

  it('M1: a payable plan is unaffected by the stall detector', () => {
    const result = calculatePayoffStrategy(
      [baseDebt({ remainingBalance: 1200, minimumPayment: 100, interestRate: 0 })],
      0,
      'avalanche'
    );
    expect(result.hasUnpayableDebts).toBe(false);
    expect(result.totalMonths).toBe(12);
    expect(result.schedules[0].paidOff).toBe(true);
  });

  it('M3: a non-focus debt payoff-month surplus rolls into the plan instead of vanishing', () => {
    // Avalanche: focus = A (20%). B ($5 balance, $100 minimum) overshoots in
    // month 1 by ~$95, which the old code discarded. With the surplus rolled,
    // the total plan pays off strictly faster than a plan where that $95/month
    // budget never existed after month 1.
    const debts = [
      baseDebt({ id: 'A', name: 'A', remainingBalance: 2000, minimumPayment: 200, interestRate: 20 }),
      baseDebt({ id: 'B', name: 'B', remainingBalance: 5, minimumPayment: 100, interestRate: 0 }),
    ];
    const withSurplus = calculatePayoffStrategy(debts, 0, 'avalanche');

    // Reference: same focus debt but B (and its freed-up $100 budget) never
    // existed at all — strictly less money available than the rolled plan.
    const reference = calculatePayoffStrategy(
      [baseDebt({ id: 'A', name: 'A', remainingBalance: 2000, minimumPayment: 200, interestRate: 20 })],
      0,
      'avalanche'
    );
    expect(withSurplus.totalMonths).toBeLessThan(reference.totalMonths);
  });

  it('M5: the recommended payment matches the simulation cadence for biweekly', () => {
    const debts = [
      baseDebt({ id: 'A', remainingBalance: 3000, minimumPayment: 300, interestRate: 12 }),
      baseDebt({ id: 'B', remainingBalance: 6000, minimumPayment: 100, interestRate: 6 }),
    ];
    const result = calculatePayoffStrategy(debts, 100, 'avalanche', 'biweekly');
    // Monthly budget 500; per biweekly period 500 / (26/12) ≈ 230.77.
    // Focus (A) gets its share: total per-period minus other minimums.
    const periods = 26 / 12;
    const expected = 500 / periods - 100 / periods;
    expect(result.nextRecommendedPayment.recommendedPayment).toBeCloseTo(expected, 2);
  });
});
