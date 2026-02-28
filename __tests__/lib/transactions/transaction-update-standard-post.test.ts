import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sales-tax/transaction-sales-tax', () => ({
  deleteSalesTaxRecord: vi.fn(),
  upsertSalesTaxSnapshot: vi.fn(),
}));

vi.mock('@/lib/transactions/transaction-update-audit', () => ({
  logTransactionUpdateAudit: vi.fn(),
}));

vi.mock('@/lib/transactions/transaction-update-bill-linking', () => ({
  autoLinkUpdatedExpenseBill: vi.fn(),
}));

vi.mock('@/lib/tax/auto-classify', () => ({
  reclassifyTransaction: vi.fn(),
  removeTransactionClassifications: vi.fn(),
}));

import { runStandardUpdatePostActions } from '@/lib/transactions/transaction-update-standard-post';
import { reclassifyTransaction, removeTransactionClassifications } from '@/lib/tax/auto-classify';
import {
  deleteSalesTaxRecord,
  upsertSalesTaxSnapshot,
} from '@/lib/sales-tax/transaction-sales-tax';

describe('runStandardUpdatePostActions tax reclassification behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes classifications when category default mode makes transaction non-deductible', async () => {
    await runStandardUpdatePostActions({
      id: 'tx-1',
      userId: 'u1',
      householdId: 'h1',
      transaction: { isTaxDeductible: true, type: 'expense' } as never,
      updateInput: { useCategoryTaxDefault: true },
      shouldDeleteSalesTaxRecord: false,
      newAccountId: 'acc-1',
      newCategoryId: 'cat-1',
      newMerchantId: null,
      newIsTaxDeductible: false,
      newTaxDeductionType: 'none',
      newDate: '2026-01-01',
      newAmount: 100,
      newDescription: 'Updated',
      newNotes: null,
      newIsPending: false,
      newIsSalesTaxable: false,
    });

    expect(removeTransactionClassifications).toHaveBeenCalledWith('tx-1');
    expect(reclassifyTransaction).not.toHaveBeenCalled();
  });

  it('reclassifies when tax-eligible category/default is active', async () => {
    await runStandardUpdatePostActions({
      id: 'tx-2',
      userId: 'u1',
      householdId: 'h1',
      transaction: { isTaxDeductible: false, type: 'expense' } as never,
      updateInput: { categoryId: 'cat-2' },
      shouldDeleteSalesTaxRecord: false,
      newAccountId: 'acc-1',
      newCategoryId: 'cat-2',
      newMerchantId: null,
      newIsTaxDeductible: true,
      newTaxDeductionType: 'business',
      newDate: '2026-01-15',
      newAmount: 250,
      newDescription: 'Consulting',
      newNotes: null,
      newIsPending: false,
      newIsSalesTaxable: false,
    });

    expect(reclassifyTransaction).toHaveBeenCalledWith(
      'u1',
      'h1',
      'tx-2',
      'cat-2',
      250,
      '2026-01-15',
      true
    );
    expect(removeTransactionClassifications).not.toHaveBeenCalled();
  });

  it('upserts sales tax snapshot for taxable income updates', async () => {
    await runStandardUpdatePostActions({
      id: 'tx-3',
      userId: 'u1',
      householdId: 'h1',
      transaction: { isTaxDeductible: false, type: 'income' } as never,
      updateInput: { amount: 10 },
      shouldDeleteSalesTaxRecord: false,
      newAccountId: 'acc-1',
      newCategoryId: null,
      newMerchantId: null,
      newIsTaxDeductible: false,
      newTaxDeductionType: 'none',
      newDate: '2026-01-02',
      newAmount: 12.34,
      newDescription: 'Sale',
      newNotes: null,
      newIsPending: false,
      newIsSalesTaxable: true,
    });

    expect(upsertSalesTaxSnapshot).toHaveBeenCalledWith({
      transactionId: 'tx-3',
      userId: 'u1',
      householdId: 'h1',
      accountId: 'acc-1',
      amountCents: 1234,
      date: '2026-01-02',
    });
    expect(deleteSalesTaxRecord).not.toHaveBeenCalledWith('tx-3');
  });

  it('deletes sales tax snapshot when update disables sales tax', async () => {
    await runStandardUpdatePostActions({
      id: 'tx-4',
      userId: 'u1',
      householdId: 'h1',
      transaction: { isTaxDeductible: false, type: 'income' } as never,
      updateInput: { isSalesTaxable: false },
      shouldDeleteSalesTaxRecord: true,
      newAccountId: 'acc-1',
      newCategoryId: null,
      newMerchantId: null,
      newIsTaxDeductible: false,
      newTaxDeductionType: 'none',
      newDate: '2026-01-02',
      newAmount: 12.34,
      newDescription: 'Sale',
      newNotes: null,
      newIsPending: false,
      newIsSalesTaxable: false,
    });

    expect(deleteSalesTaxRecord).toHaveBeenCalledWith('tx-4');
    expect(upsertSalesTaxSnapshot).not.toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'tx-4' })
    );
  });
});
