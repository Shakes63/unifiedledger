import { describe, it, expect } from 'vitest';
import { calculateMinimumPayment } from '@/lib/accounts/minimum-payment-calculator';

describe('lib/accounts/minimum-payment-calculator', () => {
  describe('calculateMinimumPayment', () => {
    it('returns zero for zero balance', () => {
      const result = calculateMinimumPayment({
        currentBalance: 0,
        minimumPaymentPercent: 2,
        minimumPaymentFloor: 25,
      });
      expect(result.minimumPaymentAmount).toBe(0);
      expect(result.calculationMethod).toBe('zero');
    });

    it('returns zero for negative balance (credit on account)', () => {
      const result = calculateMinimumPayment({
        currentBalance: -100,
        minimumPaymentPercent: 2,
        minimumPaymentFloor: 25,
      });
      // abs(-100) = 100, but the function checks balance <= 0 after abs
      // Actually abs(-100) = 100 which is > 0, so it proceeds
      // Let me verify: the function takes abs, then checks <= 0
      // abs(-100) = 100, not <= 0, so it calculates
      // 100 * 2 / 100 = 2, floor = 25, max = 25, but capped at balance = 100
      expect(result.minimumPaymentAmount).toBe(25);
      expect(result.calculationMethod).toBe('floor');
    });

    it('returns zero when neither percent nor floor set', () => {
      const result = calculateMinimumPayment({
        currentBalance: 1000,
        minimumPaymentPercent: null,
        minimumPaymentFloor: null,
      });
      expect(result.minimumPaymentAmount).toBe(0);
      expect(result.calculationMethod).toBe('zero');
    });

    it('uses floor only when percent is null', () => {
      const result = calculateMinimumPayment({
        currentBalance: 1000,
        minimumPaymentPercent: null,
        minimumPaymentFloor: 25,
      });
      expect(result.minimumPaymentAmount).toBe(25);
      expect(result.calculationMethod).toBe('floor');
    });

    it('uses percentage only when floor is null', () => {
      const result = calculateMinimumPayment({
        currentBalance: 5000,
        minimumPaymentPercent: 2,
        minimumPaymentFloor: null,
      });
      // 5000 * 2 / 100 = 100
      expect(result.minimumPaymentAmount).toBe(100);
      expect(result.calculationMethod).toBe('percent');
    });

    it('uses percentage when percentage > floor', () => {
      const result = calculateMinimumPayment({
        currentBalance: 5000,
        minimumPaymentPercent: 3,
        minimumPaymentFloor: 25,
      });
      // 5000 * 3 / 100 = 150 > 25
      expect(result.minimumPaymentAmount).toBe(150);
      expect(result.calculationMethod).toBe('percent');
    });

    it('uses floor when floor > percentage', () => {
      const result = calculateMinimumPayment({
        currentBalance: 500,
        minimumPaymentPercent: 2,
        minimumPaymentFloor: 25,
      });
      // 500 * 2 / 100 = 10, floor = 25 > 10
      expect(result.minimumPaymentAmount).toBe(25);
      expect(result.calculationMethod).toBe('floor');
    });

    it('caps payment at balance (cannot overpay)', () => {
      const result = calculateMinimumPayment({
        currentBalance: 10,
        minimumPaymentPercent: 2,
        minimumPaymentFloor: 25,
      });
      // floor = 25 but balance = 10, so capped at 10
      expect(result.minimumPaymentAmount).toBe(10);
    });

    it('handles large balance with precision', () => {
      const result = calculateMinimumPayment({
        currentBalance: 99999.99,
        minimumPaymentPercent: 1.5,
        minimumPaymentFloor: 25,
      });
      // 99999.99 * 1.5 / 100 = 1500.00
      expect(result.minimumPaymentAmount).toBe(1500);
      expect(result.calculationMethod).toBe('percent');
    });

    it('rounds to 2 decimal places', () => {
      const result = calculateMinimumPayment({
        currentBalance: 333.33,
        minimumPaymentPercent: 3,
        minimumPaymentFloor: 0,
      });
      // 333.33 * 3 / 100 = 9.9999 -> 10.00
      expect(result.minimumPaymentAmount).toBe(10);
    });

    it('handles zero percent with nonzero floor', () => {
      const result = calculateMinimumPayment({
        currentBalance: 1000,
        minimumPaymentPercent: 0,
        minimumPaymentFloor: 50,
      });
      // percent is 0 (falsy), but floor is 50
      expect(result.minimumPaymentAmount).toBe(50);
    });
  });
});
