/**
 * Tests for Batch Split Update API
 * PUT /api/transactions/[id]/splits/batch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateBatchSplits, type BatchSplitItem } from '@/lib/transactions/split-calculator';

// Mock the auth helpers
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getHouseholdIdFromRequest: vi.fn(),
  requireHouseholdAuth: vi.fn(),
}));

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
        orderBy: vi.fn(() => Promise.resolve([])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  },
}));

describe('Batch Split Validation', () => {
  describe('validateBatchSplits', () => {
    it('should validate valid fixed amount splits that sum to transaction amount', () => {
      const splits: BatchSplitItem[] = [
        { categoryId: 'cat1', amount: 50, isPercentage: false },
        { categoryId: 'cat2', amount: 50, isPercentage: false },
      ];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should validate valid percentage splits that sum to 100%', () => {
      const splits: BatchSplitItem[] = [
        { categoryId: 'cat1', percentage: 60, isPercentage: true },
        { categoryId: 'cat2', percentage: 40, isPercentage: true },
      ];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject fixed amount splits that do not sum to transaction amount', () => {
      const splits: BatchSplitItem[] = [
        { categoryId: 'cat1', amount: 50, isPercentage: false },
        { categoryId: 'cat2', amount: 30, isPercentage: false },
      ];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Amount splits must sum to');
    });

    it('should reject percentage splits that do not sum to 100%', () => {
      const splits: BatchSplitItem[] = [
        { categoryId: 'cat1', percentage: 60, isPercentage: true },
        { categoryId: 'cat2', percentage: 30, isPercentage: true },
      ];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Percentage splits must sum to 100%');
    });

    it('should reject mixed percentage and amount splits', () => {
      const splits: BatchSplitItem[] = [
        { categoryId: 'cat1', amount: 50, isPercentage: false },
        { categoryId: 'cat2', percentage: 50, isPercentage: true },
      ];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot mix percentage and amount splits');
    });

    it('should require categoryId on each split', () => {
      const splits: BatchSplitItem[] = [
        { categoryId: '', amount: 50, isPercentage: false },
        { categoryId: 'cat2', amount: 50, isPercentage: false },
      ];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Category is required');
    });

    it('should reject empty splits array', () => {
      const splits: BatchSplitItem[] = [];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('At least one split is required');
    });

    it('should allow small tolerance for floating point errors', () => {
      const splits: BatchSplitItem[] = [
        { categoryId: 'cat1', amount: 33.33, isPercentage: false },
        { categoryId: 'cat2', amount: 33.33, isPercentage: false },
        { categoryId: 'cat3', amount: 33.34, isPercentage: false },
      ];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should validate splits with optional fields', () => {
      const splits: BatchSplitItem[] = [
        {
          id: 'existing-id',
          categoryId: 'cat1',
          amount: 60,
          isPercentage: false,
          description: 'Groceries portion',
          notes: 'Some notes',
          sortOrder: 0,
        },
        {
          categoryId: 'cat2',
          amount: 40,
          isPercentage: false,
          description: 'Household items',
          sortOrder: 1,
        },
      ];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject percentage splits exceeding 100%', () => {
      const splits: BatchSplitItem[] = [
        { categoryId: 'cat1', percentage: 80, isPercentage: true },
        { categoryId: 'cat2', percentage: 30, isPercentage: true },
      ];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds 100%');
    });

    it('should reject amount splits exceeding transaction amount', () => {
      const splits: BatchSplitItem[] = [
        { categoryId: 'cat1', amount: 80, isPercentage: false },
        { categoryId: 'cat2', amount: 40, isPercentage: false },
      ];

      const result = validateBatchSplits(splits, 100);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds transaction amount');
    });
  });
});

describe('Batch Split API Request/Response Types', () => {
  it('should properly type batch split request items', () => {
    const item: BatchSplitItem = {
      id: 'split-123',
      categoryId: 'cat-456',
      amount: 50,
      isPercentage: false,
      description: 'Test split',
      notes: 'Some notes',
      sortOrder: 0,
    };

    expect(item.id).toBe('split-123');
    expect(item.categoryId).toBe('cat-456');
    expect(item.amount).toBe(50);
    expect(item.isPercentage).toBe(false);
  });

  it('should allow optional fields to be undefined', () => {
    const item: BatchSplitItem = {
      categoryId: 'cat-456',
      isPercentage: true,
      percentage: 50,
    };

    expect(item.id).toBeUndefined();
    expect(item.amount).toBeUndefined();
    expect(item.description).toBeUndefined();
    expect(item.notes).toBeUndefined();
    expect(item.sortOrder).toBeUndefined();
  });
});

describe('Batch Split Edge Cases', () => {
  it('should handle single split covering full amount', () => {
    const splits: BatchSplitItem[] = [
      { categoryId: 'cat1', amount: 100, isPercentage: false },
    ];

    const result = validateBatchSplits(splits, 100);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should handle single 100% percentage split', () => {
    const splits: BatchSplitItem[] = [
      { categoryId: 'cat1', percentage: 100, isPercentage: true },
    ];

    const result = validateBatchSplits(splits, 50);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should handle many small splits', () => {
    const splits: BatchSplitItem[] = Array.from({ length: 10 }, (_, i) => ({
      categoryId: `cat${i}`,
      amount: 10,
      isPercentage: false,
    }));

    const result = validateBatchSplits(splits, 100);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should handle zero amount in one split (when others sum correctly)', () => {
    const splits: BatchSplitItem[] = [
      { categoryId: 'cat1', amount: 100, isPercentage: false },
      { categoryId: 'cat2', amount: 0, isPercentage: false },
    ];

    const result = validateBatchSplits(splits, 100);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should handle decimal amounts with precision', () => {
    const splits: BatchSplitItem[] = [
      { categoryId: 'cat1', amount: 33.33, isPercentage: false },
      { categoryId: 'cat2', amount: 66.67, isPercentage: false },
    ];

    const result = validateBatchSplits(splits, 100);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });
});

