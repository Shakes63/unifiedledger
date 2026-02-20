import { describe, expect, it } from 'vitest';
import {
  coalesceMoneyValue,
  fromMoneyCents,
  toMoneyCents,
} from '@/lib/utils/money-cents';

describe('money-cents helpers', () => {
  it('converts decimal money to integer cents with half-up rounding', () => {
    expect(toMoneyCents(12.34)).toBe(1234);
    expect(toMoneyCents('10.005')).toBe(1001);
    expect(toMoneyCents(-1.235)).toBe(-124);
  });

  it('converts cents back to decimal money', () => {
    expect(fromMoneyCents(1234)).toBe(12.34);
    expect(fromMoneyCents('250')).toBe(2.5);
    expect(fromMoneyCents(-99)).toBe(-0.99);
  });

  it('prefers cents when coalescing and falls back to decimal amount', () => {
    expect(coalesceMoneyValue(12.34, 1234)).toBe(12.34);
    expect(coalesceMoneyValue(12.34, null)).toBe(12.34);
    expect(coalesceMoneyValue(null, 150)).toBe(1.5);
    expect(coalesceMoneyValue(null, null)).toBe(0);
  });
});
