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

  it('overspend consumes the accumulated surplus, floored at 0 (H-DBG-6)', () => {
    const result = calculateRollover({
      monthlyBudget: 500,
      actualSpent: 600,
      previousBalance: 50,
      rolloverLimit: null,
      allowNegativeRollover: false,
      categoryType: 'expense',
    });
    // The signed month amount is applied to the balance; the no-negative floor
    // applies to the RESULTING balance. Previously the amount was clamped to 0
    // so the $50 surplus survived a $100 overspend and inflated forever.
    expect(result.rolloverAmount).toBe(-100);
    expect(result.newBalance).toBe(0); // 50 - 100 floored at 0
  });

  it('audit scenario: granted surplus is drawn down when spent (H-DBG-6)', () => {
    // $100/mo budget. Month 1: unspent -> balance $100.
    const month1 = calculateRollover({
      monthlyBudget: 100,
      actualSpent: 0,
      previousBalance: 0,
      rolloverLimit: null,
      allowNegativeRollover: false,
      categoryType: 'expense',
    });
    expect(month1.newBalance).toBe(100);

    // Month 2: UI grants $200 effective; user spends all $200.
    const month2 = calculateRollover({
      monthlyBudget: 100,
      actualSpent: 200,
      previousBalance: month1.newBalance,
      rolloverLimit: null,
      allowNegativeRollover: false,
      categoryType: 'expense',
    });
    // Correct: the $100 surplus is consumed -> balance 0 (the bug left it at $100).
    expect(month2.newBalance).toBe(0);
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
    // The month amount stays signed (-400); the no-negative floor applies to the
    // RESULTING balance: -200 + (-400) = -600 -> floored at 0 (H-DBG-6).
    expect(result.rolloverAmount).toBe(-400);
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
