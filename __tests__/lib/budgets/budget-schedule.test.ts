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

    it('counts periods by START DAY within the month (May 2025 has 4 Mondays)', () => {
      const period = getCurrentBudgetPeriod(
        defaultSettings({ budgetCycleFrequency: 'weekly', budgetCycleStartDay: 1 }), // Monday
        new Date(2025, 4, 29), // May 29, 2025
      );

      // Mondays in May 2025: 5, 12, 19, 26 -> the May 26 period is #4 of 4.
      expect(period.startStr).toBe('2025-05-26');
      expect(period.periodNumber).toBe(4);
      expect(period.periodsInMonth).toBe(4);
      expect(period.owningMonth).toBe('2025-05');
    });

    it('a period keeps its number and month after crossing into the next month', () => {
      const settings = defaultSettings({
        budgetCycleFrequency: 'weekly',
        budgetCycleStartDay: 1, // Monday
      });
      // The Monday-Apr-28 period runs Apr 28 - May 4. April 2025 has Mondays on
      // 7, 14, 21, 28, so it is April's 4th period — and stays April's 4th on
      // May 1, rather than becoming "week 1 of May".
      const fromApril = getCurrentBudgetPeriod(settings, new Date(2025, 3, 30));
      const fromMay = getCurrentBudgetPeriod(settings, new Date(2025, 4, 2));

      expect(fromMay.startStr).toBe(fromApril.startStr);
      expect(fromApril.periodNumber).toBe(4);
      expect(fromMay.periodNumber).toBe(4);
      expect(fromMay.owningMonth).toBe('2025-04');

      // The next Monday opens May's period 1.
      const nextPeriod = getCurrentBudgetPeriod(settings, new Date(2025, 4, 5));
      expect(nextPeriod.startStr).toBe('2025-05-05');
      expect(nextPeriod.periodNumber).toBe(1);
      expect(nextPeriod.owningMonth).toBe('2025-05');
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

    it('counts paydays per month — January 2025 is a three-paycheck month', () => {
      const settings = defaultSettings({
        budgetCycleFrequency: 'biweekly',
        budgetCycleStartDay: 5, // Friday
        budgetCycleReferenceDate: '2025-01-03T00:00:00',
      });
      // Paydays: Jan 3, 17, 31 -> three in January.
      const third = getCurrentBudgetPeriod(settings, new Date(2025, 0, 31));
      expect(third.startStr).toBe('2025-01-31');
      expect(third.periodNumber).toBe(3);
      expect(third.periodsInMonth).toBe(3);
      expect(third.owningMonth).toBe('2025-01');
    });

    it('a payday late in the month owns its period into the next month', () => {
      const settings = defaultSettings({
        budgetCycleFrequency: 'biweekly',
        budgetCycleStartDay: 5, // Friday
        budgetCycleReferenceDate: '2025-01-03T00:00:00',
      });
      // Payday Mar 28 runs Mar 28 - Apr 10. March paydays are Mar 14 and Mar 28,
      // so it is March's 2nd — and remains so on April 5.
      const atStart = getCurrentBudgetPeriod(settings, new Date(2025, 2, 29));
      const inApril = getCurrentBudgetPeriod(settings, new Date(2025, 3, 5));

      expect(atStart.startStr).toBe('2025-03-28');
      expect(inApril.startStr).toBe('2025-03-28');
      expect(atStart.periodNumber).toBe(2);
      expect(inApril.periodNumber).toBe(2);
      expect(inApril.owningMonth).toBe('2025-03');
      expect(atStart.periodsInMonth).toBe(2);
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

describe('bug-hunt regressions (P1-P4)', () => {
  const biweekly = (overrides: Partial<BudgetScheduleSettings> = {}): BudgetScheduleSettings => ({
    budgetCycleFrequency: 'biweekly',
    budgetCycleStartDay: 1, // Monday
    budgetCycleReferenceDate: null,
    budgetCycleSemiMonthlyDays: null,
    budgetPeriodRollover: false,
    budgetPeriodManualAmount: null,
    ...overrides,
  });

  it('P1: biweekly with NO reference date tiles the calendar in stable 14-day blocks', () => {
    // The anchor used to be recomputed from `today`, so the window slid 7 days
    // per week and consecutive "current periods" overlapped — the cycle reset
    // weekly instead of biweekly.
    const settings = biweekly();
    const seen = new Map<string, string>();
    for (let day = 0; day < 70; day++) {
      const date = new Date(2026, 2, 2 + day); // Mar 2 2026 onward
      const period = getCurrentBudgetPeriod(settings, date);
      // Every date maps to exactly one period, and that period spans 14 days.
      // `end` is endOfDay of the 14th day, so start->end rounds to 14 (this
      // also absorbs the DST hour when a period crosses a transition).
      const spanDays = Math.round(
        (period.end.getTime() - period.start.getTime()) / 86_400_000
      );
      expect(spanDays).toBe(14);
      const existing = seen.get(period.startStr);
      if (existing) {
        expect(existing).toBe(period.endStr); // same start always same end
      } else {
        seen.set(period.startStr, period.endStr);
      }
    }
    // Distinct period starts must be exactly 14 days apart — no weekly slide.
    const starts = [...seen.keys()].sort();
    for (let i = 1; i < starts.length; i++) {
      // Round: 14 CALENDAR days across a DST spring-forward is 14×24h − 1h.
      const gap = Math.round(
        (new Date(`${starts[i]}T00:00:00`).getTime() -
          new Date(`${starts[i - 1]}T00:00:00`).getTime()) /
          86_400_000
      );
      expect(gap).toBe(14);
    }
  });

  it('P2: a configured reference date is honoured in local time, not shifted a week', () => {
    // '2026-03-25' is a Wednesday. With startDay=Wednesday the period must
    // START that day. UTC-parsing landed on Tue and the aligned snap then threw
    // the grid back a FULL week to Mar 18.
    const settings = biweekly({
      budgetCycleStartDay: 3, // Wednesday
      budgetCycleReferenceDate: '2026-03-25',
    });
    const period = getCurrentBudgetPeriod(settings, new Date(2026, 2, 25));
    expect(period.startStr).toBe('2026-03-25');
    expect(period.endStr).toBe('2026-04-07');
  });

  it('P4: semi-monthly day 31 never produces a period starting in the future', () => {
    const settings: BudgetScheduleSettings = {
      budgetCycleFrequency: 'semi-monthly',
      budgetCycleStartDay: null,
      budgetCycleReferenceDate: null,
      budgetCycleSemiMonthlyDays: '[5,31]',
      budgetPeriodRollover: false,
      budgetPeriodManualAmount: null,
    };
    const today = new Date(2026, 2, 1); // Mar 1 2026 (Feb has 28 days)
    const period = getCurrentBudgetPeriod(settings, today);
    // setDate(Feb 1, 31) used to overflow to Mar 3 — a period starting two days
    // after "today", with today outside its own period.
    expect(period.start.getTime()).toBeLessThanOrEqual(today.getTime());
    expect(period.startStr).toBe('2026-02-28');
  });
});
