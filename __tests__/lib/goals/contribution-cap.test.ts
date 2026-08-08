/**
 * Bug-hunt findings M3/A5 (transfer branch had no cap) and A6 (the cap that did
 * exist was bypassable with a negative offsetting entry).
 *
 * The cap exists because `goalContributions` is an unvalidated request-body
 * field: without it a $10 transfer could credit a goal $10,000, fire every
 * milestone, and feed fabricated savings into the savings-rate report.
 */
import { describe, expect, it } from 'vitest';
import { contributionsExceedTransaction } from '@/lib/goals/contribution-handler';

describe('contributionsExceedTransaction (M3/A5/A6)', () => {
  it('allows contributions within the transaction amount', () => {
    expect(contributionsExceedTransaction([{ goalId: 'g1', amount: 100 }], 100)).toBe(false);
    expect(
      contributionsExceedTransaction(
        [
          { goalId: 'g1', amount: 60 },
          { goalId: 'g2', amount: 40 },
        ],
        100
      )
    ).toBe(false);
  });

  it('rejects contributions exceeding the transaction amount', () => {
    expect(contributionsExceedTransaction([{ goalId: 'g1', amount: 10000 }], 10)).toBe(true);
  });

  it('uses the absolute amount, so expenses (negative) still cap', () => {
    expect(contributionsExceedTransaction([{ goalId: 'g1', amount: 10000 }], -10)).toBe(true);
    expect(contributionsExceedTransaction([{ goalId: 'g1', amount: 10 }], -10)).toBe(false);
  });

  it('A6: a negative entry cannot offset an oversized positive one', () => {
    // Sums to 5, which is under a $10 transaction — the old sum-only guard
    // passed this, then credited g1 the full $10,000 while silently dropping g2.
    expect(
      contributionsExceedTransaction(
        [
          { goalId: 'g1', amount: 10000 },
          { goalId: 'g2', amount: -9995 },
        ],
        10
      )
    ).toBe(true);
  });

  it('A6: rejects zero and non-finite entries outright', () => {
    expect(contributionsExceedTransaction([{ goalId: 'g1', amount: 0 }], 100)).toBe(true);
    expect(contributionsExceedTransaction([{ goalId: 'g1', amount: NaN }], 100)).toBe(true);
    expect(contributionsExceedTransaction([{ goalId: 'g1', amount: Infinity }], 100)).toBe(true);
  });

  it('tolerates a half-cent of float representation error', () => {
    expect(contributionsExceedTransaction([{ goalId: 'g1', amount: 100.001 }], 100)).toBe(false);
    expect(contributionsExceedTransaction([{ goalId: 'g1', amount: 100.02 }], 100)).toBe(true);
  });
});
