import { describe, expect, it } from 'vitest';

import { calculateDiscretionaryAmounts } from '@/lib/budgets/discretionary-calculation';

describe('lib/budgets/discretionary-calculation', () => {
  it('does not double-count posted income or paid spending', () => {
    const result = calculateDiscretionaryAmounts({
      includedBalance: 3000,
      expectedIncome: 2000,
      actualIncome: 2000,
      billsPending: 500,
      budgetRemaining: 600,
    });

    expect(result.currentDiscretionary).toBe(1900);
    expect(result.projectedDiscretionary).toBe(1900);
    expect(result.expectedDiscretionary).toBe(1900);
    expect(result.variance).toBe(0);
  });

  it('adds only remaining income to end-of-period projection', () => {
    const result = calculateDiscretionaryAmounts({
      includedBalance: 3000,
      expectedIncome: 2500,
      actualIncome: 1000,
      billsPending: 500,
      budgetRemaining: -200,
    });

    expect(result.currentDiscretionary).toBe(2500);
    expect(result.projectedDiscretionary).toBe(4000);
    expect(result.expectedDiscretionary).toBe(4000);
    expect(result.variance).toBe(1500);
  });

  it('never subtracts income when actual exceeds expected', () => {
    const result = calculateDiscretionaryAmounts({
      includedBalance: 1000,
      expectedIncome: 1000,
      actualIncome: 1500,
      billsPending: 200,
      budgetRemaining: 300,
    });

    expect(result.currentDiscretionary).toBe(500);
    expect(result.projectedDiscretionary).toBe(500);
    expect(result.variance).toBe(0);
  });
});
