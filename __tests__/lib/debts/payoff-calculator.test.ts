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

      // Should hit MAX_PERIODS limit (360 months) since payment < interest
      expect(result.totalMonths).toBe(360);
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

    it('handles large debt ($1M)', () => {
      const debts = [baseDebt({
        remainingBalance: 1000000,
        minimumPayment: 5000,
        interestRate: 5,
        loanType: 'installment',
      })];
      const result = calculatePayoffStrategy(debts, 0, 'avalanche');

      expect(result.totalMonths).toBeGreaterThan(0);
      expect(result.totalMonths).toBeLessThanOrEqual(360);
      expect(result.totalInterestPaid).toBeGreaterThan(0);
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
