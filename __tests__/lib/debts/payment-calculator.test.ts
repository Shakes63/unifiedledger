import { describe, it, expect } from 'vitest';
import { calculatePaymentBreakdown } from '@/lib/debts/payment-calculator';

describe('lib/debts/payment-calculator', () => {
  describe('calculatePaymentBreakdown', () => {
    it('zero rate: entire payment goes to principal', () => {
      const result = calculatePaymentBreakdown(200, 5000, 0, 'fixed', 'revolving');
      expect(result.interestAmount).toBe(0);
      expect(result.principalAmount).toBe(200);
      expect(result.totalPayment).toBe(200);
    });

    it('no interest type: entire payment goes to principal', () => {
      const result = calculatePaymentBreakdown(200, 5000, 18, 'none', 'revolving');
      expect(result.interestAmount).toBe(0);
      expect(result.principalAmount).toBe(200);
    });

    it('precomputed interest: entire payment goes to principal', () => {
      const result = calculatePaymentBreakdown(200, 5000, 18, 'precomputed', 'revolving');
      expect(result.interestAmount).toBe(0);
      expect(result.principalAmount).toBe(200);
    });

    describe('revolving credit', () => {
      it('daily compounding: uses daily rate * billing cycle days', () => {
        // 5000 * (18/100/365) * 30 = 73.97...
        const result = calculatePaymentBreakdown(200, 5000, 18, 'fixed', 'revolving', 'daily', 30);
        expect(result.interestAmount).toBeCloseTo(73.97, 1);
        expect(result.principalAmount).toBeCloseTo(126.03, 1);
      });

      it('monthly compounding: uses annual rate / 12', () => {
        // 5000 * 18/100 / 12 = 75
        const result = calculatePaymentBreakdown(200, 5000, 18, 'fixed', 'revolving', 'monthly');
        expect(result.interestAmount).toBe(75);
        expect(result.principalAmount).toBe(125);
      });

      it('quarterly compounding: uses annual rate / 4 / 3', () => {
        // 5000 * (18/100/4) / 3 = 75
        const result = calculatePaymentBreakdown(200, 5000, 18, 'fixed', 'revolving', 'quarterly');
        expect(result.interestAmount).toBe(75);
        expect(result.principalAmount).toBe(125);
      });

      it('annual compounding: uses annual rate / 12', () => {
        // 5000 * 18/100 / 12 = 75
        const result = calculatePaymentBreakdown(200, 5000, 18, 'fixed', 'revolving', 'annually');
        expect(result.interestAmount).toBe(75);
        expect(result.principalAmount).toBe(125);
      });
    });

    describe('installment loans', () => {
      it('uses simple monthly interest', () => {
        // 10000 * 6/100/12 = 50
        const result = calculatePaymentBreakdown(300, 10000, 6, 'fixed', 'installment');
        expect(result.interestAmount).toBe(50);
        expect(result.principalAmount).toBe(250);
      });

      it('handles high rate correctly', () => {
        // 5000 * 24/100/12 = 100
        const result = calculatePaymentBreakdown(200, 5000, 24, 'fixed', 'installment');
        expect(result.interestAmount).toBe(100);
        expect(result.principalAmount).toBe(100);
      });
    });

    describe('edge cases', () => {
      it('payment < interest results in zero principal and interest capped at the payment', () => {
        // Interest accrued: 5000 * 24/100/12 = 100, payment = 50. The RECORDED
        // interest is capped at what was actually paid (bug-hunt finding LC3) —
        // the old $100 figure overstated interest reports by money never paid.
        const result = calculatePaymentBreakdown(50, 5000, 24, 'fixed', 'installment');
        expect(result.interestAmount).toBe(50);
        expect(result.principalAmount).toBe(0);
      });

      it('exact payoff (balance + interest = payment)', () => {
        // Interest: 100 * 12/100/12 = 1, payment should be 101
        const result = calculatePaymentBreakdown(101, 100, 12, 'fixed', 'installment');
        expect(result.interestAmount).toBe(1);
        expect(result.principalAmount).toBe(100);
      });

      it('large balance precision', () => {
        // 1000000 * 5/100/12 = 4166.666... -> rounds to 4166.67
        const result = calculatePaymentBreakdown(5000, 1000000, 5, 'fixed', 'installment');
        expect(result.interestAmount).toBe(4166.67);
        expect(result.principalAmount).toBeCloseTo(833.33, 1);
      });

      it('zero balance means no interest and no principal', () => {
        // Paying a zero-balance debt records NO principal (bug-hunt finding
        // LC1): the old $200 principal was later "restored" by a reversal,
        // creating debt out of thin air.
        const result = calculatePaymentBreakdown(200, 0, 18, 'fixed', 'revolving');
        expect(result.interestAmount).toBe(0);
        expect(result.principalAmount).toBe(0);
      });
    });
  });
});

describe('bug-hunt regressions (LC1/LC3)', () => {
  it('LC3: recorded interest never exceeds the money actually paid', () => {
    // $10,000 revolving at 24% APR -> ~$200 monthly interest; a $50 payment
    // used to record $200 of interest and $0 principal (paid $50, booked $200).
    const breakdown = calculatePaymentBreakdown(50, 10000, 24, 'fixed', 'revolving', 'monthly');
    expect(breakdown.interestAmount).toBeLessThanOrEqual(50);
    expect(breakdown.interestAmount + breakdown.principalAmount).toBeLessThanOrEqual(50);
  });

  it('LC1: recorded principal never exceeds the remaining balance', () => {
    // $500 payment on a $300 balance: the unclamped $500 principal was stored
    // on the payment row, and reversing it later restored MORE debt than ever
    // existed ($300 debt reborn at $500).
    const zeroRate = calculatePaymentBreakdown(500, 300, 0, 'none');
    expect(zeroRate.principalAmount).toBe(300);

    const withRate = calculatePaymentBreakdown(500, 300, 12, 'fixed', 'installment');
    expect(withRate.principalAmount).toBeLessThanOrEqual(300);
    expect(withRate.interestAmount).toBeGreaterThan(0);
  });
});
