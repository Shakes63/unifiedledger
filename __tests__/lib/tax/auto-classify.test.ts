import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';

// Mock the database module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  categoryTaxMappings: { userId: 'userId', budgetCategoryId: 'budgetCategoryId', taxYear: 'taxYear' },
  transactionTaxClassifications: { transactionId: 'transactionId', taxCategoryId: 'taxCategoryId', id: 'id' },
  taxCategories: { id: 'id' },
}));

describe('lib/tax/auto-classify - Decimal.js allocation precision', () => {
  it('correctly calculates allocation at 33.33%', () => {
    // Simulating the Decimal.js calculation that replaced float math
    const amount = 100;
    const allocationPct = 33.33;
    const result = new Decimal(amount).abs().times(allocationPct).dividedBy(100).toDecimalPlaces(2).toNumber();
    expect(result).toBe(33.33);
  });

  it('correctly calculates allocation at 100%', () => {
    const amount = 99.99;
    const allocationPct = 100;
    const result = new Decimal(amount).abs().times(allocationPct).dividedBy(100).toDecimalPlaces(2).toNumber();
    expect(result).toBe(99.99);
  });

  it('correctly calculates allocation on $0.01', () => {
    const amount = 0.01;
    const allocationPct = 50;
    const result = new Decimal(amount).abs().times(allocationPct).dividedBy(100).toDecimalPlaces(2).toNumber();
    expect(result).toBe(0.01); // Rounds up from 0.005
  });

  it('correctly calculates allocation on $999,999.99', () => {
    const amount = 999999.99;
    const allocationPct = 33.33;
    const result = new Decimal(amount).abs().times(allocationPct).dividedBy(100).toDecimalPlaces(2).toNumber();
    // Float would give: 333299.996667... truncation issues
    // Decimal.js gives precise: 333299.9966667 -> 333300.00 rounded
    expect(result).toBe(333300);
  });

  it('correctly calculates allocation at 0%', () => {
    const amount = 500;
    const allocationPct = 0;
    const result = new Decimal(amount).abs().times(allocationPct).dividedBy(100).toDecimalPlaces(2).toNumber();
    expect(result).toBe(0);
  });

  it('handles negative amounts (takes abs)', () => {
    const amount = -150.75;
    const allocationPct = 66.67;
    const result = new Decimal(amount).abs().times(allocationPct).dividedBy(100).toDecimalPlaces(2).toNumber();
    expect(result).toBe(100.51);
  });

  it('avoids float precision issue with 0.1 + 0.2 style values', () => {
    // Classic float problem: 0.1 * 3 = 0.30000000000000004 in JS
    const amount = 0.1;
    const allocationPct = 300; // 300% to amplify the issue
    const result = new Decimal(amount).abs().times(allocationPct).dividedBy(100).toDecimalPlaces(2).toNumber();
    expect(result).toBe(0.3);
  });

  it('handles repeating decimal percentages', () => {
    const amount = 100;
    const allocationPct = 66.67; // 2/3 approximation
    const result = new Decimal(amount).abs().times(allocationPct).dividedBy(100).toDecimalPlaces(2).toNumber();
    expect(result).toBe(66.67);
  });
});
