/**
 * M-BILL-7 / M-DBG-14: bill day-of-month matching must read the day from the
 * date STRING, not `new Date('YYYY-MM-DD').getDate()` which returns the previous
 * day in UTC-negative timezones (this repo's documented pitfall).
 */
import { describe, expect, it } from 'vitest';
import { checkDateMatch } from '@/lib/bills/bill-matcher';

describe('checkDateMatch timezone safety (M-BILL-7)', () => {
  it('matches a bill due the 1st for a transaction dated the 1st', () => {
    // In America/* timezones, new Date('2026-03-01').getDate() is 28/29 (Feb).
    expect(checkDateMatch('2026-03-01', 1)).toBe(true);
  });

  it('matches within the 2-day window using the string day', () => {
    expect(checkDateMatch('2026-03-03', 1)).toBe(true); // diff 2
    expect(checkDateMatch('2026-03-15', 15)).toBe(true); // exact
  });

  it('does not match outside the window', () => {
    expect(checkDateMatch('2026-03-10', 1)).toBe(false); // diff 9
  });

  it('handles month wraparound (day 1 vs day 30)', () => {
    expect(checkDateMatch('2026-03-30', 1)).toBe(true); // diff 29 >= 28
  });
});
