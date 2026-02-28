import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@/lib/transactions/transaction-create-resource-load', () => ({
  loadCreateAccountsOrResponse: vi.fn(),
}));

vi.mock('@/lib/transactions/transaction-create-rule-orchestration', () => ({
  executeCreateRuleApplication: vi.fn(),
}));

vi.mock('@/lib/transactions/transaction-create-branch-run', () => ({
  executeCreateBranchOrResponse: vi.fn(),
}));

vi.mock('@/lib/transactions/transaction-create-finalization', () => ({
  finalizeCreatedTransaction: vi.fn(),
}));

import { executeCreateTransactionOrchestration } from '@/lib/transactions/transaction-create-orchestrator';
import { loadCreateAccountsOrResponse } from '@/lib/transactions/transaction-create-resource-load';
import { executeCreateRuleApplication } from '@/lib/transactions/transaction-create-rule-orchestration';
import { executeCreateBranchOrResponse } from '@/lib/transactions/transaction-create-branch-run';
import { finalizeCreatedTransaction } from '@/lib/transactions/transaction-create-finalization';

describe('executeCreateTransactionOrchestration tax precedence', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (loadCreateAccountsOrResponse as Mock).mockResolvedValue({
      account: {
        id: 'acc-1',
        name: 'Checking',
        enableTaxDeductions: false,
        isBusinessAccount: false,
      },
      toAccount: null,
      category: {
        id: 'cat-1',
        isTaxDeductible: true,
        isBusinessCategory: true,
      },
    });

    (executeCreateRuleApplication as Mock).mockResolvedValue({
      appliedCategoryId: 'cat-1',
      appliedRuleId: null,
      appliedActions: [],
      finalDescription: 'Lunch',
      finalMerchantId: 'merch-1',
      postCreationMutations: null,
    });

    (executeCreateBranchOrResponse as Mock).mockResolvedValue({ transferInId: null });
    (finalizeCreatedTransaction as Mock).mockResolvedValue(Response.json({ id: 'tx-1' }));
  });

  it('uses category defaults when useCategoryTaxDefault is true', async () => {
    await executeCreateTransactionOrchestration({
      userId: 'u1',
      householdId: 'h1',
      selectedEntityId: 'e1',
      startTime: Date.now(),
      body: {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        merchantId: 'merch-1',
        date: '2026-01-01',
        amount: 12.5,
        description: 'Lunch',
        type: 'expense',
        useCategoryTaxDefault: true,
        isTaxDeductible: false,
        taxDeductionType: 'personal',
      },
    });

    expect(executeCreateBranchOrResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveIsTaxDeductible: true,
        effectiveTaxDeductionType: 'business',
      })
    );
  });

  it('uses transaction override when useCategoryTaxDefault is false', async () => {
    await executeCreateTransactionOrchestration({
      userId: 'u1',
      householdId: 'h1',
      selectedEntityId: 'e1',
      startTime: Date.now(),
      body: {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        merchantId: 'merch-1',
        date: '2026-01-01',
        amount: 42.0,
        description: 'Office supplies',
        type: 'expense',
        useCategoryTaxDefault: false,
        isTaxDeductible: false,
      },
    });

    expect(executeCreateBranchOrResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveIsTaxDeductible: false,
        effectiveTaxDeductionType: 'none',
      })
    );
  });
});
