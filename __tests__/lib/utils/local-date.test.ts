import { describe, expect, it } from 'vitest';
import {
  getMonthRangeForDate,
  getMonthRangeForYearMonth,
  getRelativeLocalDateString,
  getTodayLocalDateString,
  getYearRangeForDate,
  parseLocalDateString,
  toLocalDateString,
} from '@/lib/utils/local-date';

describe('local-date helpers', () => {
  it('formats local date strings without UTC conversion', () => {
    const date = new Date(2026, 1, 9, 23, 45, 12);
    expect(toLocalDateString(date)).toBe('2026-02-09');
  });

  it('parses YYYY-MM-DD into local calendar dates', () => {
    const parsed = parseLocalDateString('2026-02-19');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(1);
    expect(parsed.getDate()).toBe(19);
  });

  it('builds month ranges with leap-year support', () => {
    expect(getMonthRangeForYearMonth(2024, 2)).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
  });

  it('builds month ranges from a Date object', () => {
    expect(getMonthRangeForDate(new Date(2026, 10, 15))).toEqual({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
  });

  it('builds yearly range from a Date object', () => {
    expect(getYearRangeForDate(new Date(2026, 6, 4))).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
  });

  it('supports relative local date offsets', () => {
    const base = new Date(2026, 0, 1, 10, 0, 0);
    expect(getRelativeLocalDateString(-1, base)).toBe('2025-12-31');
    expect(getRelativeLocalDateString(1, base)).toBe('2026-01-02');
  });

  it('returns today in local YYYY-MM-DD shape', () => {
    expect(getTodayLocalDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
