import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  calculateRecommendedMonthlySavings,
  formatCurrency,
} from '@/lib/goals/calculate-recommended-savings';

// NOTE: system time is set with new Date(y, m, d) — LOCAL midnight. Using
// new Date('YYYY-MM-DD') here gives UTC midnight, which is the previous day in
// any timezone behind UTC and silently shifts every "days remaining" assertion.
describe('lib/goals/calculate-recommended-savings', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateRecommendedMonthlySavings', () => {
    it('returns goal achieved when current >= target', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 1));
      const result = calculateRecommendedMonthlySavings(1000, 1000, '2025-12-01');
      expect(result.isAchievable).toBe(true);
      expect(result.amountRemaining).toBe(0);
      expect(result.message).toBe('Goal achieved!');
      expect(result.recommendedMonthly).toBeNull();
    });

    it('returns goal achieved when current exceeds target', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 1));
      const result = calculateRecommendedMonthlySavings(1000, 1500, '2025-12-01');
      expect(result.amountRemaining).toBe(0);
      expect(result.message).toBe('Goal achieved!');
    });

    it('prompts to set target date when none provided', () => {
      const result = calculateRecommendedMonthlySavings(10000, 2000, null);
      expect(result.recommendedMonthly).toBeNull();
      expect(result.monthsRemaining).toBeNull();
      expect(result.amountRemaining).toBe(8000);
      expect(result.message).toContain('Set a target date');
    });

    it('handles undefined target date', () => {
      const result = calculateRecommendedMonthlySavings(10000, 2000, undefined);
      expect(result.recommendedMonthly).toBeNull();
      expect(result.message).toContain('Set a target date');
    });

    it('detects target date in the past', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 1));
      const result = calculateRecommendedMonthlySavings(10000, 2000, '2025-01-01');
      expect(result.isAchievable).toBe(false);
      expect(result.monthsRemaining).toBe(0);
      expect(result.message).toBe('Target date has passed');
    });

    it('M12/P2: a goal due tomorrow has not passed, west of UTC', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 7, 8)); // Aug 8 local
      // new Date('2026-08-09') is UTC midnight = Aug 8 19:00 in America/Chicago,
      // which setHours then pinned to Aug 8 — so a goal due TOMORROW reported
      // "Target date has passed" and offered no recommendation at all.
      const result = calculateRecommendedMonthlySavings(1000, 0, '2026-08-09');
      expect(result.isAchievable).toBe(true);
      expect(result.message).not.toBe('Target date has passed');
      expect(result.recommendedMonthly).not.toBeNull();
    });

    it('handles 1 day remaining (tight timeline)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 1));
      const result = calculateRecommendedMonthlySavings(10000, 9000, '2025-06-02');
      // 1 day remaining, less than 1 month
      expect(result.isTightTimeline).toBe(true);
      expect(result.recommendedMonthly).toBe(1000); // Full remaining amount
      expect(result.message).toContain('1 days remaining');
    });

    it('calculates for 12 months remaining', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 1));
      // ~365 days / 30.44 = ~11.99 months
      const result = calculateRecommendedMonthlySavings(12000, 0, '2025-12-31');
      expect(result.recommendedMonthly).toBeGreaterThan(0);
      expect(result.monthsRemaining).toBeGreaterThan(11);
      expect(result.isAchievable).toBe(true);
    });

    it('uses ROUND_UP to ensure goal is met by target', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 1));
      // 10000 / ~5.94 months = ~1683.50 (rounded up)
      const result = calculateRecommendedMonthlySavings(10000, 0, '2025-07-01');
      expect(result.recommendedMonthly).not.toBeNull();
      // Verify monthly amount * fractional months >= remaining amount
      // The function uses Decimal.ROUND_UP so monthly * months should cover the goal
      if (result.recommendedMonthly && result.monthsRemaining) {
        const totalFromPayments = result.recommendedMonthly * result.monthsRemaining;
        expect(totalFromPayments).toBeGreaterThanOrEqual(10000);
      }
    });

    it('handles $0.01 remaining', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 1));
      const result = calculateRecommendedMonthlySavings(100, 99.99, '2025-12-01');
      expect(result.amountRemaining).toBeCloseTo(0.01, 2);
      expect(result.recommendedMonthly).toBeGreaterThan(0);
    });

    it('handles large target with small current', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 1));
      const result = calculateRecommendedMonthlySavings(1000000, 100, '2027-01-01');
      expect(result.recommendedMonthly).toBeGreaterThan(0);
      expect(result.amountRemaining).toBe(999900);
    });

    it('isTightTimeline is true for < 2 months', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 1));
      const result = calculateRecommendedMonthlySavings(5000, 0, '2025-07-15');
      // ~44 days / 30.44 = ~1.45 months < 2
      expect(result.isTightTimeline).toBe(true);
    });

    it('isTightTimeline is false for > 2 months', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 1));
      const result = calculateRecommendedMonthlySavings(5000, 0, '2025-06-01');
      expect(result.isTightTimeline).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    it('formats positive amounts', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('formats small amounts', () => {
      expect(formatCurrency(0.01)).toBe('$0.01');
    });
  });
});
