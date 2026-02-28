import Decimal from 'decimal.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/transactions/transaction-create-bill-linking', () => ({
  autoLinkCreatedExpenseBill: vi.fn().mockResolvedValue({ linkedBillId: null }),
}));
vi.mock('@/lib/transactions/transaction-create-audit', () => ({
  logTransactionCreateAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/transactions/transaction-create-debt-linking', () => ({
  linkTransactionDebt: vi.fn().mockResolvedValue({ linkedDebtId: null }),
}));
vi.mock('@/lib/transactions/transaction-create-post-metadata', () => ({
  runTransactionCreateMetadataUpdates: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/transactions/transaction-create-performance', () => ({
  logTransactionCreatePerformance: vi.fn(),
}));
vi.mock('@/lib/transactions/money-movement-service', () => ({
  amountToCents: vi.fn().mockImplementation((v: Decimal) => v.times(100).toNumber()),
}));
vi.mock('@/lib/sales-tax/transaction-sales-tax', () => ({
  upsertSalesTaxSnapshot: vi.fn().mockResolvedValue(undefined),
  deleteSalesTaxRecord: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/transactions/transaction-create-finalization-helpers', () => ({
  isCreatedTransactionSalesTaxable: vi.fn(),
  buildCreateTransactionSuccessResponse: vi.fn().mockReturnValue(Response.json({ id: 'tx-1' })),
}));

import { finalizeCreatedTransaction } from '@/lib/transactions/transaction-create-finalization';
import {
  deleteSalesTaxRecord,
  upsertSalesTaxSnapshot,
} from '@/lib/sales-tax/transaction-sales-tax';
import { isCreatedTransactionSalesTaxable } from '@/lib/transactions/transaction-create-finalization-helpers';

describe('finalizeCreatedTransaction sales tax sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts snapshot when created transaction is taxable income', async () => {
    vi.mocked(isCreatedTransactionSalesTaxable).mockReturnValue(true);

    await finalizeCreatedTransaction({
      userId: 'u1',
      householdId: 'h1',
      transactionId: 'tx-1',
      transferInId: null,
      accountId: 'a1',
      categoryId: 'c1',
      finalMerchantId: null,
      decimalAmount: new Decimal(12.34),
      appliedRuleId: null,
      appliedCategoryId: 'c1',
      appliedActions: [],
      type: 'income',
      description: 'Sale',
      finalDescription: 'Sale',
      date: '2026-01-15',
      isPending: false,
      startTime: Date.now(),
      postCreationMutations: null,
      isSalesTaxable: true,
      effectiveIsTaxDeductible: false,
    });

    expect(upsertSalesTaxSnapshot).toHaveBeenCalledWith({
      transactionId: 'tx-1',
      userId: 'u1',
      householdId: 'h1',
      accountId: 'a1',
      amountCents: 1234,
      date: '2026-01-15',
    });
    expect(deleteSalesTaxRecord).not.toHaveBeenCalled();
  });

  it('deletes snapshot when created transaction is not taxable', async () => {
    vi.mocked(isCreatedTransactionSalesTaxable).mockReturnValue(false);

    await finalizeCreatedTransaction({
      userId: 'u1',
      householdId: 'h1',
      transactionId: 'tx-2',
      transferInId: null,
      accountId: 'a1',
      categoryId: 'c1',
      finalMerchantId: null,
      decimalAmount: new Decimal(10),
      appliedRuleId: null,
      appliedCategoryId: 'c1',
      appliedActions: [],
      type: 'income',
      description: 'Sale',
      finalDescription: 'Sale',
      date: '2026-01-15',
      isPending: false,
      startTime: Date.now(),
      postCreationMutations: null,
      isSalesTaxable: false,
      effectiveIsTaxDeductible: false,
    });

    expect(deleteSalesTaxRecord).toHaveBeenCalledWith('tx-2');
    expect(upsertSalesTaxSnapshot).not.toHaveBeenCalled();
  });
});
