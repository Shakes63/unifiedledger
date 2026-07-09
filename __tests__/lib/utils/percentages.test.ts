import { describe, expect, it } from 'vitest';
import { allocatePercentages } from '@/lib/utils/percentages';

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('allocatePercentages (L-RPT-13)', () => {
  it('three equal thirds sum to exactly 100 (independent rounding gives 99.9)', () => {
    const parts = allocatePercentages([1, 1, 1], 1);
    expect(sum(parts)).toBeCloseTo(100, 10);
    // One of them absorbs the leftover tenth.
    expect(parts.sort()).toEqual([33.3, 33.3, 33.4]);
  });

  it('a principal/interest split sums to exactly 100', () => {
    // 33.35 / 66.65 — naive toFixed(1) display shows 33.3 + 66.6 = 99.9.
    const parts = allocatePercentages([33.35, 66.65], 1);
    expect(sum(parts)).toBeCloseTo(100, 10);
  });

  it('integer precision works (decimals = 0)', () => {
    const parts = allocatePercentages([1, 1, 1], 0);
    expect(sum(parts)).toBe(100);
    expect(parts.sort()).toEqual([33, 33, 34]);
  });

  it('preserves proportionality ordering', () => {
    const parts = allocatePercentages([10, 20, 70], 1);
    expect(parts[0]).toBeLessThan(parts[1]);
    expect(parts[1]).toBeLessThan(parts[2]);
    expect(sum(parts)).toBeCloseTo(100, 10);
  });

  it('returns zeros for a zero/empty total instead of NaN', () => {
    expect(allocatePercentages([0, 0], 1)).toEqual([0, 0]);
    expect(allocatePercentages([], 1)).toEqual([]);
  });

  it('handles a single value as exactly 100', () => {
    expect(allocatePercentages([42.42], 1)).toEqual([100]);
  });

  it('is stable across many random-ish distributions', () => {
    // Deterministic pseudo-random values; every allocation must hit exactly 100.
    for (let seed = 1; seed <= 50; seed++) {
      const values = Array.from({ length: (seed % 7) + 2 }, (_, i) => ((seed * 31 + i * 17) % 97) + 0.5);
      const parts = allocatePercentages(values, 1);
      expect(sum(parts)).toBeCloseTo(100, 10);
    }
  });
});
