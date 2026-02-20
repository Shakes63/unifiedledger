import { describe, it, expect } from 'vitest';
import { calculateRollover } from '@/lib/budgets/rollover-utils';

describe('lib/budgets/rollover-utils - calculateRollover', () => {
  it('calculates positive rollover when under budget', () => {
    const result = calculateRollover({
      monthlyBudget: 500,
      actualSpent: 400,
      previousBalance: 0,
      rolloverLimit: null,
      allowNegativeRollover: false,
      categoryType: 'expense',
    });
    expect(result.rolloverAmount).toBe(100);
    expect(result.newBalance).toBe(100);
    expect(result.wasCapped).toBe(false);
  });

  it('calculates negative rollover when over budget and allowed', () => {
    const result = calculateRollover({
      monthlyBudget: 500,
      actualSpent: 600,
      previousBalance: 200,
      rolloverLimit: null,
      allowNegativeRollover: true,
      categoryType: 'expense',
    });
    expect(result.rolloverAmount).toBe(-100);
    expect(result.newBalance).toBe(100); // 200 + (-100) = 100
    expect(result.wasCapped).toBe(false);
  });

  it('clamps negative rollover to 0 when not allowed', () => {
    const result = calculateRollover({
      monthlyBudget: 500,
      actualSpent: 600,
      previousBalance: 50,
      rolloverLimit: null,
      allowNegativeRollover: false,
      categoryType: 'expense',
    });
    expect(result.rolloverAmount).toBe(0); // Clamped from -100
    expect(result.newBalance).toBe(50); // Previous balance unchanged
  });

  it('applies rollover cap', () => {
    const result = calculateRollover({
      monthlyBudget: 1000,
      actualSpent: 200,
      previousBalance: 400,
      rolloverLimit: 500,
      allowNegativeRollover: false,
      categoryType: 'expense',
    });
    // Unused: 800, new balance would be 400 + 800 = 1200, capped at 500
    expect(result.rolloverAmount).toBe(800);
    expect(result.newBalance).toBe(500);
    expect(result.wasCapped).toBe(true);
  });

  it('accumulates with previous balance', () => {
    const result = calculateRollover({
      monthlyBudget: 500,
      actualSpent: 300,
      previousBalance: 100,
      rolloverLimit: null,
      allowNegativeRollover: false,
      categoryType: 'expense',
    });
    // Unused: 200, new balance: 100 + 200 = 300
    expect(result.rolloverAmount).toBe(200);
    expect(result.newBalance).toBe(300);
  });

  it('skips rollover for income categories', () => {
    const result = calculateRollover({
      monthlyBudget: 5000,
      actualSpent: 3000,
      previousBalance: 100,
      rolloverLimit: null,
      allowNegativeRollover: false,
      categoryType: 'income',
    });
    expect(result.rolloverAmount).toBe(0);
    expect(result.newBalance).toBe(100); // Unchanged
  });

  it('prevents negative new balance when not allowed', () => {
    const result = calculateRollover({
      monthlyBudget: 100,
      actualSpent: 500,
      previousBalance: -200,
      rolloverLimit: null,
      allowNegativeRollover: false,
      categoryType: 'expense',
    });
    // rolloverAmount would be -400 but clamped to 0
    // newBalance = -200 + 0 = -200, but clamped to 0
    expect(result.rolloverAmount).toBe(0);
    expect(result.newBalance).toBe(0);
  });

  it('allows negative new balance when allowed', () => {
    const result = calculateRollover({
      monthlyBudget: 100,
      actualSpent: 500,
      previousBalance: 0,
      rolloverLimit: null,
      allowNegativeRollover: true,
      categoryType: 'expense',
    });
    // rolloverAmount = -400, newBalance = 0 + (-400) = -400
    expect(result.rolloverAmount).toBe(-400);
    expect(result.newBalance).toBe(-400);
  });

  it('handles zero budget correctly', () => {
    const result = calculateRollover({
      monthlyBudget: 0,
      actualSpent: 100,
      previousBalance: 50,
      rolloverLimit: null,
      allowNegativeRollover: true,
      categoryType: 'expense',
    });
    // Unused: 0 - 100 = -100
    expect(result.rolloverAmount).toBe(-100);
    expect(result.newBalance).toBe(-50); // 50 + (-100) = -50
  });

  it('handles zero spending', () => {
    const result = calculateRollover({
      monthlyBudget: 500,
      actualSpent: 0,
      previousBalance: 0,
      rolloverLimit: null,
      allowNegativeRollover: false,
      categoryType: 'expense',
    });
    expect(result.rolloverAmount).toBe(500);
    expect(result.newBalance).toBe(500);
  });

  it('Feb in non-leap year boundary (from processMonthlyRollover context)', () => {
    // This tests the date calculation: Feb 2025 has 28 days
    const year = 2025;
    const monthNum = 2;
    const lastDay = new Date(year, monthNum, 0).getDate();
    expect(lastDay).toBe(28);
  });

  it('Feb in leap year boundary', () => {
    const year = 2024;
    const monthNum = 2;
    const lastDay = new Date(year, monthNum, 0).getDate();
    expect(lastDay).toBe(29);
  });
});
