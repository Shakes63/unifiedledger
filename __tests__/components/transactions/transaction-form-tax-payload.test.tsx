import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TransactionForm } from '@/components/transactions/transaction-form';

const postWithHouseholdMock = vi.fn();
const putWithHouseholdMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/contexts/household-context', () => ({
  useHousehold: () => ({
    initialized: true,
    loading: false,
    selectedHouseholdId: 'hh-1',
  }),
}));

vi.mock('@/lib/hooks/use-household-fetch', () => ({
  useHouseholdFetch: () => ({
    selectedHouseholdId: 'hh-1',
    fetchWithHousehold: vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    })),
    postWithHousehold: postWithHouseholdMock,
    putWithHousehold: putWithHouseholdMock,
  }),
}));

vi.mock('@/hooks/useHapticFeedback', () => ({
  HapticFeedbackTypes: {
    transactionCreated: vi.fn(),
    transactionError: vi.fn(),
  },
}));

vi.mock('@/components/transactions/hooks/use-household-accounts', () => ({
  useHouseholdAccounts: () => ({
    accounts: [
      {
        id: 'acc-1',
        name: 'Checking',
        enableSalesTax: false,
        isBusinessAccount: false,
        currentBalance: 1000,
      },
    ],
  }),
}));

vi.mock('@/components/transactions/hooks/use-transfer-detections', () => ({
  useTransferDetections: () => ({
    savingsDetection: null,
    paymentBillDetection: null,
    loadingSavingsDetection: false,
  }),
}));

vi.mock('@/components/transactions/hooks/use-unpaid-bills', () => ({
  useUnpaidBills: () => ({
    unpaidBills: [],
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/components/transactions/transaction-form-persistence', () => ({
  syncTransactionTags: vi.fn(async () => undefined),
  syncTransactionCustomFields: vi.fn(async () => undefined),
  syncTransactionSplits: vi.fn(async () => undefined),
}));

vi.mock('@/components/transactions/account-selector', () => ({
  AccountSelector: ({ onAccountChange }: { onAccountChange: (id: string) => void }) => (
    <button type="button" onClick={() => onAccountChange('acc-1')}>
      Pick Account
    </button>
  ),
}));

vi.mock('@/components/transactions/category-selector', () => ({
  CategorySelector: ({ onCategoryChange }: { onCategoryChange: (id: string) => void }) => (
    <button type="button" onClick={() => onCategoryChange('cat-1')}>
      Pick Category
    </button>
  ),
}));

vi.mock('@/components/transactions/merchant-selector', () => ({
  MerchantSelector: () => <div>Merchant Selector</div>,
}));

vi.mock('@/components/transactions/transaction-templates-manager', () => ({
  TransactionTemplatesManager: () => <div>Templates</div>,
}));

vi.mock('@/components/transactions/split-builder', () => ({
  SplitBuilder: () => <div>Split Builder</div>,
}));

vi.mock('@/components/transactions/budget-warning', () => ({
  BudgetWarning: () => <div>Budget Warning</div>,
}));

vi.mock('@/components/transactions/goal-selector', () => ({
  GoalSelector: () => <div>Goal Selector</div>,
}));

vi.mock('@/components/transactions/transaction-form-actions', () => ({
  TransactionFormActions: () => <button type="submit">Save Transaction</button>,
}));

describe('TransactionForm tax payload serialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postWithHouseholdMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'tx-1' }),
    });
    putWithHouseholdMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'tx-1' }),
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as unknown as Response);
  });

  it('sends category-default tax fields by default', async () => {
    render(<TransactionForm defaultType="expense" />);

    fireEvent.click(screen.getByRole('button', { name: /pick account/i }));
    fireEvent.change(screen.getByLabelText(/amount \*/i), { target: { value: '25.00' } });
    fireEvent.change(screen.getByLabelText(/description \*/i), { target: { value: 'Lunch' } });
    fireEvent.click(screen.getByRole('button', { name: /save transaction/i }));

    await waitFor(() => expect(postWithHouseholdMock).toHaveBeenCalled());

    expect(postWithHouseholdMock).toHaveBeenCalledWith(
      '/api/transactions',
      expect.objectContaining({
        useCategoryTaxDefault: true,
        isTaxDeductible: undefined,
        taxDeductionType: undefined,
      })
    );
  });

  it('sends transaction-level tax override fields when override mode is enabled', async () => {
    render(<TransactionForm defaultType="expense" />);

    fireEvent.click(screen.getByRole('button', { name: /pick account/i }));
    fireEvent.change(screen.getByLabelText(/amount \*/i), { target: { value: '42.00' } });
    fireEvent.change(screen.getByLabelText(/description \*/i), { target: { value: 'Office supplies' } });
    fireEvent.click(screen.getByLabelText(/use category default tax treatment/i));
    fireEvent.click(screen.getByLabelText(/mark this transaction as tax deductible/i));
    fireEvent.click(screen.getByRole('button', { name: /save transaction/i }));

    await waitFor(() => expect(postWithHouseholdMock).toHaveBeenCalled());

    expect(postWithHouseholdMock).toHaveBeenCalledWith(
      '/api/transactions',
      expect.objectContaining({
        useCategoryTaxDefault: false,
        isTaxDeductible: true,
        taxDeductionType: 'personal',
      })
    );
  });
});
