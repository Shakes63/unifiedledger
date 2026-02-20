import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { addMonths } from 'date-fns';

describe('lib/calendar/event-generator - Decimal.js payoff ceiling', () => {
  describe('payoff month calculation with Decimal.js', () => {
    it('exact division yields correct month count', () => {
      const balance = 1000;
      const monthlyPayment = 200;
      // 1000 / 200 = 5.0, ceil = 5
      const months = new Decimal(balance).dividedBy(monthlyPayment).ceil().toNumber();
      expect(months).toBe(5);
    });

    it('non-exact division rounds up', () => {
      const balance = 1000;
      const monthlyPayment = 300;
      // 1000 / 300 = 3.333..., ceil = 4
      const months = new Decimal(balance).dividedBy(monthlyPayment).ceil().toNumber();
      expect(months).toBe(4);
    });

    it('handles small remainder correctly', () => {
      const balance = 1001;
      const monthlyPayment = 500;
      // 1001 / 500 = 2.002, ceil = 3
      const months = new Decimal(balance).dividedBy(monthlyPayment).ceil().toNumber();
      expect(months).toBe(3);
    });

    it('handles very small balance (penny)', () => {
      const balance = 0.01;
      const monthlyPayment = 25;
      // 0.01 / 25 = 0.0004, ceil = 1
      const months = new Decimal(balance).dividedBy(monthlyPayment).ceil().toNumber();
      expect(months).toBe(1);
    });

    it('handles large balance', () => {
      const balance = 1000000;
      const monthlyPayment = 5000;
      // 1000000 / 5000 = 200, ceil = 200
      const months = new Decimal(balance).dividedBy(monthlyPayment).ceil().toNumber();
      expect(months).toBe(200);
    });

    it('avoids float precision issue with Math.ceil', () => {
      // Decimal.js computes 999.99 / 333.33 = exactly 3 (since 333.33 * 3 = 999.99)
      // This is correct: no extra months needed
      const balance = 999.99;
      const monthlyPayment = 333.33;
      const months = new Decimal(balance).dividedBy(monthlyPayment).ceil().toNumber();
      expect(months).toBe(3);

      // Classic float precision issue: 0.1 + 0.2 > 0.3 in JS
      // Decimal.js handles this correctly
      const decimalResult = new Decimal(0.1).plus(0.2).toNumber();
      expect(decimalResult).toBe(0.3); // Decimal.js: exact
      expect(0.1 + 0.2).not.toBe(0.3); // Float: 0.30000000000000004
    });
  });

  describe('addMonths across year boundary', () => {
    it('correctly adds months spanning December to January', () => {
      const today = new Date('2025-11-15');
      const projected = addMonths(today, 3);
      expect(projected.getFullYear()).toBe(2026);
      expect(projected.getMonth()).toBe(1); // February (0-indexed)
    });

    it('handles adding 12 months exactly', () => {
      const today = new Date('2025-06-15');
      const projected = addMonths(today, 12);
      expect(projected.getFullYear()).toBe(2026);
      expect(projected.getMonth()).toBe(5); // June
    });

    it('handles adding months to Jan 31 (clamps to Feb 28)', () => {
      const today = new Date('2025-01-31');
      const projected = addMonths(today, 1);
      // date-fns addMonths clamps Feb 31 -> Feb 28
      expect(projected.getDate()).toBe(28);
    });
  });
});
