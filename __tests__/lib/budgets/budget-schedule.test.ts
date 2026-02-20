import { describe, it, expect } from 'vitest';
import {
  getCurrentBudgetPeriod,
  getNextBudgetPeriod,
  getDaysUntilNextPeriod,
  parseSemiMonthlyDays,
  getPeriodBudgetAmount,
  getPeriodsPerMonth,
  isDateInPeriod,
  calculateAvailableAmount,
  validateBudgetScheduleSettings,
  type BudgetScheduleSettings,
} from '@/lib/budgets/budget-schedule';

function defaultSettings(overrides: Partial<BudgetScheduleSettings> = {}): BudgetScheduleSettings {
  return {
    budgetCycleFrequency: 'monthly',
    budgetCycleStartDay: null,
    budgetCycleReferenceDate: null,
    budgetCycleSemiMonthlyDays: '[1, 15]',
    budgetPeriodRollover: false,
    budgetPeriodManualAmount: null,
    ...overrides,
  };
}

describe('lib/budgets/budget-schedule', () => {
  describe('parseSemiMonthlyDays', () => {
    it('returns default [1, 15] for null', () => {
      expect(parseSemiMonthlyDays(null)).toEqual([1, 15]);
    });

    it('parses valid JSON', () => {
      expect(parseSemiMonthlyDays('[5, 20]')).toEqual([5, 20]);
    });

    it('sorts days in ascending order', () => {
      expect(parseSemiMonthlyDays('[20, 5]')).toEqual([5, 20]);
    });

    it('returns default for invalid JSON', () => {
      expect(parseSemiMonthlyDays('invalid')).toEqual([1, 15]);
    });

    it('returns default for empty array', () => {
      expect(parseSemiMonthlyDays('[]')).toEqual([1, 15]);
    });

    it('filters out-of-range days', () => {
      expect(parseSemiMonthlyDays('[0, 32]')).toEqual([1, 15]);
    });
  });

  describe('getCurrentBudgetPeriod - monthly', () => {
    it('returns month boundaries', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 0, 15),
      );
      expect(period.startStr).toBe('2025-01-01');
      expect(period.endStr).toBe('2025-01-31');
      expect(period.periodNumber).toBe(1);
      expect(period.periodsInMonth).toBe(1);
    });

    it('handles February in non-leap year', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 1, 15),
      );
      expect(period.startStr).toBe('2025-02-01');
      expect(period.endStr).toBe('2025-02-28');
    });

    it('handles February in leap year', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2024, 1, 15),
      );
      expect(period.startStr).toBe('2024-02-01');
      expect(period.endStr).toBe('2024-02-29');
    });

    it('handles months with 30 days', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 3, 15),
      );
      expect(period.endStr).toBe('2025-04-30');
    });
  });

  describe('getCurrentBudgetPeriod - weekly', () => {
    it('uses configured start day', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'weekly', budgetCycleStartDay: 1 }), // Monday
        new Date(2025, 0, 15), // Wednesday
      );
      // Should start on Monday Jan 13
      expect(period.startStr).toBe('2025-01-13');
      // Should end on Sunday Jan 19
      expect(period.endStr).toBe('2025-01-19');
    });

    it('defaults to Sunday start', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'weekly', budgetCycleStartDay: null }),
        new Date(2025, 0, 15), // Wednesday
      );
      // Should start on Sunday Jan 12
      expect(period.startStr).toBe('2025-01-12');
    });

    it('calculates dynamic periodsInMonth for five-week months', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'weekly', budgetCycleStartDay: 1 }), // Monday
        new Date(2025, 4, 29), // May 29, 2025
      );

      expect(period.startStr).toBe('2025-05-26');
      expect(period.periodNumber).toBe(5);
      expect(period.periodsInMonth).toBe(5);
    });
  });

  describe('getCurrentBudgetPeriod - biweekly', () => {
    it('uses reference date for period calculation', () => {
      // Use 'T00:00:00' suffix so the date string is parsed as local time,
      // not UTC (ISO date-only strings like '2025-01-03' are parsed as UTC midnight
      // which can shift to the previous day in timezones behind UTC).
      const period = getCurrentBudgetPeriod(
        defaultSettings({
          budgetCycleFrequency: 'biweekly',
          budgetCycleStartDay: 5, // Friday
          budgetCycleReferenceDate: '2025-01-03T00:00:00', // A Friday, parsed as local time
        }),
        new Date(2025, 0, 10), // One week later
      );
      // Should still be in the first biweekly period starting Jan 3
      expect(period.startStr).toBe('2025-01-03');
    });

    it('calculates dynamic periodsInMonth for three-paycheck months', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({
          budgetCycleFrequency: 'biweekly',
          budgetCycleStartDay: 5, // Friday
          budgetCycleReferenceDate: '2025-01-03T00:00:00',
        }),
        new Date(2025, 2, 29), // March 29, 2025
      );

      expect(period.startStr).toBe('2025-03-28');
      expect(period.periodNumber).toBe(3);
      expect(period.periodsInMonth).toBe(3);
    });
  });

  describe('getCurrentBudgetPeriod - semi-monthly', () => {
    it('returns first period for day in first half', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({
          budgetCycleFrequency: 'semi-monthly',
          budgetCycleSemiMonthlyDays: '[1, 15]',
        }),
        new Date(2025, 0, 10),
      );
      expect(period.startStr).toBe('2025-01-01');
      expect(period.periodNumber).toBe(1);
    });

    it('returns second period for day in second half', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({
          budgetCycleFrequency: 'semi-monthly',
          budgetCycleSemiMonthlyDays: '[1, 15]',
        }),
        new Date(2025, 0, 20),
      );
      expect(period.startStr).toBe('2025-01-15');
      expect(period.periodNumber).toBe(2);
    });

    it('handles custom split days [5, 20]', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({
          budgetCycleFrequency: 'semi-monthly',
          budgetCycleSemiMonthlyDays: '[5, 20]',
        }),
        new Date(2025, 0, 10),
      );
      expect(period.startStr).toBe('2025-01-05');
      expect(period.periodNumber).toBe(1);
    });

    it('clamps second day in short months', () => {
      // February only has 28/29 days, if second day is 30 it should clamp
      const period = getCurrentBudgetPeriod(
        defaultSettings({
          budgetCycleFrequency: 'semi-monthly',
          budgetCycleSemiMonthlyDays: '[1, 30]',
        }),
        new Date(2025, 1, 15),
      );
      // Feb 28 is last day, so effective second day = 28
      expect(period.periodNumber).toBe(1);
    });
  });

  describe('getNextBudgetPeriod', () => {
    it('returns next month for monthly', () => {
      const period = getNextBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 0, 15),
      );
      expect(period.startStr).toBe('2025-02-01');
    });
  });

  describe('getDaysUntilNextPeriod', () => {
    it('counts remaining days including today', () => {
      const days = getDaysUntilNextPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 0, 30),
      );
      // Jan 30 + Jan 31 = 2 days remaining
      expect(days).toBe(2);
    });

    it('returns 1 on last day of period', () => {
      const days = getDaysUntilNextPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 0, 31),
      );
      expect(days).toBe(1);
    });
  });

  describe('getPeriodBudgetAmount', () => {
    it('returns full monthly amount for monthly frequency', () => {
      expect(getPeriodBudgetAmount(1000, 'monthly')).toBe(1000);
    });

    it('divides by ~4.33 for weekly frequency', () => {
      const result = getPeriodBudgetAmount(1000, 'weekly');
      expect(result).toBeCloseTo(230.95, 1);
    });

    it('divides by 2 for biweekly frequency', () => {
      expect(getPeriodBudgetAmount(1000, 'biweekly')).toBe(500);
    });

    it('divides by 2 for semi-monthly frequency', () => {
      expect(getPeriodBudgetAmount(1000, 'semi-monthly')).toBe(500);
    });

    it('uses manual override when provided', () => {
      expect(getPeriodBudgetAmount(1000, 'monthly', 750)).toBe(750);
    });

    it('ignores manual override when null', () => {
      expect(getPeriodBudgetAmount(1000, 'monthly', null)).toBe(1000);
    });
  });

  describe('getPeriodsPerMonth', () => {
    it('returns 1 for monthly', () => {
      expect(getPeriodsPerMonth('monthly')).toBe(1);
    });

    it('returns 4.33 for weekly', () => {
      expect(getPeriodsPerMonth('weekly')).toBe(4.33);
    });

    it('returns 2.17 for biweekly', () => {
      expect(getPeriodsPerMonth('biweekly')).toBe(2.17);
    });

    it('returns 2 for semi-monthly', () => {
      expect(getPeriodsPerMonth('semi-monthly')).toBe(2);
    });
  });

  describe('isDateInPeriod', () => {
    it('returns true for date at period start', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 0, 15),
      );
      expect(isDateInPeriod(new Date(2025, 0, 1), period)).toBe(true);
    });

    it('returns true for date at period end', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 0, 15),
      );
      expect(isDateInPeriod(new Date(2025, 0, 31), period)).toBe(true);
    });

    it('returns false for date before period', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 1, 15),
      );
      expect(isDateInPeriod(new Date(2025, 0, 31), period)).toBe(false);
    });

    it('returns false for date after period', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 0, 15),
      );
      expect(isDateInPeriod(new Date(2025, 1, 1), period)).toBe(false);
    });

    it('accepts string dates', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'monthly' }),
        new Date(2025, 0, 15),
      );
      // String dates are parsed via new Date() which treats date-only as UTC.
      // Use a mid-month date that won't shift across month boundaries.
      expect(isDateInPeriod('2025-01-15', period)).toBe(true);
    });
  });

  describe('calculateAvailableAmount', () => {
    it('calculates available from all components', () => {
      const available = calculateAvailableAmount(5000, 1000, 500, 300, 200);
      // 5000 + 200 - 1000 - 500 - 300 = 3400
      expect(available).toBe(3400);
    });

    it('handles zero rollover', () => {
      const available = calculateAvailableAmount(5000, 1000, 500, 300);
      // 5000 - 1000 - 500 - 300 = 3200
      expect(available).toBe(3200);
    });

    it('can go negative when expenses exceed balance', () => {
      const available = calculateAvailableAmount(500, 1000, 500, 300);
      // 500 - 1000 - 500 - 300 = -1300
      expect(available).toBe(-1300);
    });
  });

  describe('validateBudgetScheduleSettings', () => {
    it('validates valid settings', () => {
      const result = validateBudgetScheduleSettings({
        budgetCycleFrequency: 'monthly',
      });
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('rejects invalid frequency', () => {
      const result = validateBudgetScheduleSettings({
        budgetCycleFrequency: 'invalid' as 'monthly',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects start day outside 0-6', () => {
      const result = validateBudgetScheduleSettings({
        budgetCycleStartDay: 7,
      });
      expect(result.valid).toBe(false);
    });

    it('rejects negative manual amount', () => {
      const result = validateBudgetScheduleSettings({
        budgetPeriodManualAmount: -100,
      });
      expect(result.valid).toBe(false);
    });

    it('rejects semi-monthly days where first >= second', () => {
      const result = validateBudgetScheduleSettings({
        budgetCycleSemiMonthlyDays: '[20, 5]',
      });
      expect(result.valid).toBe(false);
    });
  });
});
