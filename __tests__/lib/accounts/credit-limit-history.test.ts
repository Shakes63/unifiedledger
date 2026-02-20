import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';

// Mock the database module
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  creditLimitHistory: {},
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'test-id-123',
}));

import { trackCreditLimitChange, determineChangeReason } from '@/lib/accounts/credit-limit-history';
import { db } from '@/lib/db';

describe('lib/accounts/credit-limit-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('determineChangeReason', () => {
    it('returns initial for null previous limit', () => {
      expect(determineChangeReason(null, 5000)).toBe('initial');
    });

    it('returns bank_increase when new > previous', () => {
      expect(determineChangeReason(5000, 7500)).toBe('bank_increase');
    });

    it('returns bank_decrease when new < previous', () => {
      expect(determineChangeReason(5000, 3000)).toBe('bank_decrease');
    });

    it('returns user_update when same limit', () => {
      expect(determineChangeReason(5000, 5000)).toBe('user_update');
    });
  });

  describe('Utilization precision with Decimal.js', () => {
    it('calculates utilizationBefore as null for null previous limit', () => {
      // Simulating the Decimal.js calculation
      const previousLimit = null;
      const currentBalance = 500;
      const utilizationBefore = previousLimit && previousLimit > 0
        ? new Decimal(currentBalance).dividedBy(previousLimit).times(100).toDecimalPlaces(2).toNumber()
        : null;
      expect(utilizationBefore).toBeNull();
    });

    it('calculates utilizationBefore as null for zero previous limit', () => {
      const previousLimit = 0;
      const currentBalance = 500;
      const utilizationBefore = previousLimit && previousLimit > 0
        ? new Decimal(currentBalance).dividedBy(previousLimit).times(100).toDecimalPlaces(2).toNumber()
        : null;
      expect(utilizationBefore).toBeNull();
    });

    it('calculates utilization with Decimal.js precision', () => {
      const previousLimit = 3000;
      const currentBalance = 1000;
      const utilizationBefore = new Decimal(currentBalance).dividedBy(previousLimit).times(100).toDecimalPlaces(2).toNumber();
      // 1000 / 3000 * 100 = 33.33... -> rounds to 33.33
      expect(utilizationBefore).toBe(33.33);
    });

    it('calculates utilization for repeating decimal correctly', () => {
      const limit = 7;
      const balance = 1;
      const utilization = new Decimal(balance).dividedBy(limit).times(100).toDecimalPlaces(2).toNumber();
      // 1/7 * 100 = 14.285714... -> 14.29
      expect(utilization).toBe(14.29);
    });

    it('calculates utilizationAfter as 0 when new limit is 0', () => {
      const newLimit = 0;
      const currentBalance = 500;
      const utilizationAfter = newLimit > 0
        ? new Decimal(currentBalance).dividedBy(newLimit).times(100).toDecimalPlaces(2).toNumber()
        : 0;
      expect(utilizationAfter).toBe(0);
    });

    it('handles high utilization after limit decrease', () => {
      const newLimit = 1000;
      const currentBalance = 2500;
      const utilizationAfter = new Decimal(currentBalance).dividedBy(newLimit).times(100).toDecimalPlaces(2).toNumber();
      expect(utilizationAfter).toBe(250);
    });
  });

  describe('trackCreditLimitChange', () => {
    it('calls db.insert with correct values', async () => {
      const mockValues = vi.fn();
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

      await trackCreditLimitChange({
        accountId: 'acc-1',
        userId: 'user-1',
        householdId: 'hh-1',
        previousLimit: 5000,
        newLimit: 7500,
        changeReason: 'bank_increase',
        currentBalance: 1000,
      });

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledTimes(1);
      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues.accountId).toBe('acc-1');
      expect(insertedValues.previousLimit).toBe(5000);
      expect(insertedValues.newLimit).toBe(7500);
      expect(insertedValues.utilizationBefore).toBe(20);
      expect(insertedValues.utilizationAfter).toBe(13.33);
    });
  });
});
