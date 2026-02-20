import { describe, it, expect } from 'vitest';
import { calculateNextDueDate } from '@/lib/bills/bill-utils';

describe('lib/bills/bill-utils - calculateNextDueDate', () => {
  describe('one-time bills', () => {
    it('returns the specific due date', () => {
      const result = calculateNextDueDate('one-time', 0, '2025-03-15', new Date(2025, 0, 1), 0);
      expect(result).toBe('2025-03-15');
    });

    it('throws when no specific due date', () => {
      expect(() => {
        calculateNextDueDate('one-time', 0, null, new Date(2025, 0, 1), 0);
      }).toThrow('Specific due date required');
    });
  });

  describe('weekly bills', () => {
    it('schedules for next occurrence of day of week', () => {
      // Jan 15 2025 is Wednesday (day 3)
      // dueDate = 5 (Friday)
      const result = calculateNextDueDate('weekly', 5, null, new Date(2025, 0, 15), 0);
      expect(result).toBe('2025-01-17'); // Next Friday
    });

    it('schedules for next week if due day is today (index 0)', () => {
      // Jan 15 2025 is Wednesday (day 3)
      const result = calculateNextDueDate('weekly', 3, null, new Date(2025, 0, 15), 0);
      expect(result).toBe('2025-01-22'); // Next Wednesday (same day = next week)
    });

    it('creates subsequent instances 7 days apart', () => {
      const result0 = calculateNextDueDate('weekly', 5, null, new Date(2025, 0, 15), 0);
      const result1 = calculateNextDueDate('weekly', 5, null, new Date(2025, 0, 15), 1);
      const date0 = new Date(result0);
      const date1 = new Date(result1);
      const daysDiff = (date1.getTime() - date0.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(7);
    });

    it('spans month boundary correctly', () => {
      // Jan 29 2025 is Wednesday (day 3), due Friday (day 5)
      const result = calculateNextDueDate('weekly', 5, null, new Date(2025, 0, 29), 0);
      expect(result).toBe('2025-01-31'); // Friday Jan 31
      const result1 = calculateNextDueDate('weekly', 5, null, new Date(2025, 0, 29), 1);
      expect(result1).toBe('2025-02-07'); // Friday Feb 7
    });
  });

  describe('biweekly bills', () => {
    it('schedules every 14 days', () => {
      const result0 = calculateNextDueDate('biweekly', 5, null, new Date(2025, 0, 15), 0);
      const result1 = calculateNextDueDate('biweekly', 5, null, new Date(2025, 0, 15), 1);
      const date0 = new Date(result0);
      const date1 = new Date(result1);
      const daysDiff = (date1.getTime() - date0.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(14);
    });

    it('schedules 2 weeks out if due day is today (index 0)', () => {
      // Jan 15 2025 is Wednesday (day 3)
      const result = calculateNextDueDate('biweekly', 3, null, new Date(2025, 0, 15), 0);
      expect(result).toBe('2025-01-29');
    });

    it('spans year boundary correctly', () => {
      const result = calculateNextDueDate('biweekly', 5, null, new Date(2025, 11, 20), 1);
      const resultDate = new Date(result);
      expect(resultDate.getFullYear()).toBe(2026);
    });
  });

  describe('monthly bills', () => {
    it('returns same day of month', () => {
      // Monthly instanceIndex=0 uses current month (January)
      const result = calculateNextDueDate('monthly', 15, null, new Date(2025, 0, 1), 0);
      expect(result).toBe('2025-01-15');
    });

    it('creates subsequent instances 1 month apart', () => {
      const result0 = calculateNextDueDate('monthly', 15, null, new Date(2025, 0, 1), 0);
      const result1 = calculateNextDueDate('monthly', 15, null, new Date(2025, 0, 1), 1);
      expect(result0).toBe('2025-01-15');
      expect(result1).toBe('2025-02-15');
    });

    it('clamps day 31 to 28 in February (non-leap)', () => {
      const result = calculateNextDueDate('monthly', 31, null, new Date(2025, 1, 1), 0);
      expect(result).toBe('2025-02-28');
    });

    it('clamps day 31 to 29 in February (leap year)', () => {
      const result = calculateNextDueDate('monthly', 31, null, new Date(2024, 1, 1), 0);
      expect(result).toBe('2024-02-29');
    });

    it('clamps day 31 to 30 in April', () => {
      const result = calculateNextDueDate('monthly', 31, null, new Date(2025, 3, 1), 0);
      expect(result).toBe('2025-04-30');
    });

    it('clamps day 31 to 30 in June', () => {
      const result = calculateNextDueDate('monthly', 31, null, new Date(2025, 5, 1), 0);
      expect(result).toBe('2025-06-30');
    });

    it('clamps day 31 to 30 in September', () => {
      const result = calculateNextDueDate('monthly', 31, null, new Date(2025, 8, 1), 0);
      expect(result).toBe('2025-09-30');
    });

    it('clamps day 31 to 30 in November', () => {
      const result = calculateNextDueDate('monthly', 31, null, new Date(2025, 10, 1), 0);
      expect(result).toBe('2025-11-30');
    });

    it('preserves day 29 in February leap year', () => {
      const result = calculateNextDueDate('monthly', 29, null, new Date(2024, 1, 1), 0);
      expect(result).toBe('2024-02-29');
    });

    it('clamps day 29 to 28 in February non-leap year', () => {
      const result = calculateNextDueDate('monthly', 29, null, new Date(2025, 1, 1), 0);
      expect(result).toBe('2025-02-28');
    });
  });

  describe('quarterly bills', () => {
    it('generates instances 3 months apart', () => {
      // Quarterly with no startMonth: starts from currentMonth (January)
      const result0 = calculateNextDueDate('quarterly', 15, null, new Date(2025, 0, 1), 0);
      const result1 = calculateNextDueDate('quarterly', 15, null, new Date(2025, 0, 1), 1);
      expect(result0).toBe('2025-01-15');
      expect(result1).toBe('2025-04-15');
    });

    it('uses startMonth when provided', () => {
      const result = calculateNextDueDate('quarterly', 15, null, new Date(2025, 0, 1), 0, 2); // March start
      expect(result).toBe('2025-03-15');
    });

    it('clamps day 31 in short months', () => {
      // currentDate is Feb 1, no startMonth => baseMonth = currentMonth = 1 (Feb)
      const result = calculateNextDueDate('quarterly', 31, null, new Date(2025, 1, 1), 0);
      expect(result).toBe('2025-02-28');
    });
  });

  describe('semi-annual bills', () => {
    it('generates instances 6 months apart', () => {
      // Semi-annual with no startMonth: starts from currentMonth (January)
      const result0 = calculateNextDueDate('semi-annual', 1, null, new Date(2025, 0, 1), 0);
      const result1 = calculateNextDueDate('semi-annual', 1, null, new Date(2025, 0, 1), 1);
      expect(result0).toBe('2025-01-01');
      expect(result1).toBe('2025-07-01');
    });

    it('with startMonth', () => {
      // startMonth=5 (June), currentDate is Jan 1
      // startMonth (5) >= currentMonth (0)? Yes, so no adjustment needed
      const result = calculateNextDueDate('semi-annual', 15, null, new Date(2025, 0, 1), 0, 5);
      expect(result).toBe('2025-06-15');
    });
  });

  describe('annual bills', () => {
    it('generates instances 12 months apart', () => {
      // Annual with no startMonth: starts from currentMonth (January)
      const result0 = calculateNextDueDate('annual', 1, null, new Date(2025, 0, 1), 0);
      const result1 = calculateNextDueDate('annual', 1, null, new Date(2025, 0, 1), 1);
      expect(result0).toBe('2025-01-01');
      expect(result1).toBe('2026-01-01');
    });

    it('with startMonth', () => {
      // startMonth=11 (December), currentDate is Jan 1
      // startMonth (11) >= currentMonth (0)? Yes, so no adjustment needed
      const result = calculateNextDueDate('annual', 15, null, new Date(2025, 0, 1), 0, 11);
      expect(result).toBe('2025-12-15');
    });
  });

  describe('unknown frequency', () => {
    it('throws for unknown frequency', () => {
      expect(() => {
        calculateNextDueDate('daily' as string, 1, null, new Date(2025, 0, 1), 0);
      }).toThrow('Unknown frequency');
    });
  });
});
