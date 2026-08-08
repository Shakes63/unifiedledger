/**
 * Bug-hunt finding SEC5: budget routes parseInt'd the halves of ?month=YYYY-MM
 * without checking them, so `?month=foo` produced NaN year/month, the month
 * range became "NaN-NaN-NaN", and every date comparison matched nothing — a
 * 200 response confidently reporting $0 spent.
 */
import { describe, expect, it } from 'vitest';
import { parseYearMonthParam } from '@/lib/utils/local-date';

describe('parseYearMonthParam (SEC5)', () => {
  it('defaults to the current local month when absent', () => {
    const now = new Date(2026, 6, 15);
    expect(parseYearMonthParam(null, now)).toEqual({ year: 2026, month: 7 });
    expect(parseYearMonthParam('', now)).toEqual({ year: 2026, month: 7 });
  });

  it('parses a well-formed YYYY-MM', () => {
    expect(parseYearMonthParam('2026-01')).toEqual({ year: 2026, month: 1 });
    expect(parseYearMonthParam('2026-12')).toEqual({ year: 2026, month: 12 });
  });

  it.each(['foo', '2026', '2026-', '26-01', '2026-1', '2026-01-15', 'NaN-NaN', ' 2026-01'])(
    'rejects malformed input %s',
    (input) => {
      expect(parseYearMonthParam(input)).toBeNull();
    }
  );

  it('rejects out-of-range months', () => {
    expect(parseYearMonthParam('2026-00')).toBeNull();
    expect(parseYearMonthParam('2026-13')).toBeNull();
    expect(parseYearMonthParam('2026-99')).toBeNull();
  });
});
