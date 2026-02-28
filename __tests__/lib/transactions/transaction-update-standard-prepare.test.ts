import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@/lib/transactions/transaction-update-validation', () => ({
  deriveUpdatedTransactionValues: vi.fn(),
  validateUpdatedTransactionReferences: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { prepareStandardTransactionUpdate } from '@/lib/transactions/transaction-update-standard-prepare';
import {
  deriveUpdatedTransactionValues,
  validateUpdatedTransactionReferences,
} from '@/lib/transactions/transaction-update-validation';
import { db } from '@/lib/db';

describe('prepareStandardTransactionUpdate tax defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (deriveUpdatedTransactionValues as Mock).mockReturnValue({
      newAccountId: 'acc-1',
      newAmount: { toNumber: () => 100 },
      oldAmountCents: 10000,
      newAmountCents: 10000,
      newDate: '2026-01-01',
      newDescription: 'Test',
      newNotes: null,
      newIsPending: false,
      newCategoryId: 'cat-1',
      newMerchantId: null,
      newIsTaxDeductible: false,
      newTaxDeductionType: 'none',
      newIsSalesTaxable: false,
    });
    (validateUpdatedTransactionReferences as Mock).mockResolvedValue({
      errorResponse: null,
      shouldDeleteSalesTaxRecord: false,
    });
  });

  it('uses category defaults when explicitly requested', async () => {
    (db.select as Mock).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [{ isTaxDeductible: true, isBusinessCategory: true }],
        }),
      }),
    });

    const result = await prepareStandardTransactionUpdate({
      userId: 'u1',
      householdId: 'h1',
      selectedEntityId: 'e1',
      transaction: { categoryId: 'cat-1' } as never,
      updateInput: { useCategoryTaxDefault: true },
    });

    expect(result.newIsTaxDeductible).toBe(true);
    expect(result.newTaxDeductionType).toBe('business');
  });

  it('uses category defaults when category changes without explicit tax fields', async () => {
    (db.select as Mock).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [{ isTaxDeductible: true, isBusinessCategory: false }],
        }),
      }),
    });

    const result = await prepareStandardTransactionUpdate({
      userId: 'u1',
      householdId: 'h1',
      selectedEntityId: 'e1',
      transaction: { categoryId: 'cat-0' } as never,
      updateInput: { categoryId: 'cat-1' },
    });

    expect(result.newIsTaxDeductible).toBe(true);
    expect(result.newTaxDeductionType).toBe('personal');
  });

  it('keeps derived values when category-default mode is not active', async () => {
    const result = await prepareStandardTransactionUpdate({
      userId: 'u1',
      householdId: 'h1',
      selectedEntityId: 'e1',
      transaction: { categoryId: 'cat-1' } as never,
      updateInput: { isTaxDeductible: false, taxDeductionType: 'none' },
    });

    expect(result.newIsTaxDeductible).toBe(false);
    expect(result.newTaxDeductionType).toBe('none');
    expect(db.select).not.toHaveBeenCalled();
  });
});
