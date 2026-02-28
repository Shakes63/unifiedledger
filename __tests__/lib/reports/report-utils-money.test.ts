import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {},
}));

vi.mock('@/lib/db/schema', () => ({
  transactions: {},
  budgetCategories: {},
  accounts: {},
}));

import {
  calculateByType,
  calculateSum,
  getAccountBalanceValue,
  getTransactionAmountCents,
  type TransactionData,
} from '@/lib/reports/report-utils';

function buildTxn(overrides: Partial<TransactionData>): TransactionData {
  return {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    categoryId: null,
    merchantId: null,
    date: '2026-02-19',
    amount: 0,
    amountCents: 0,
    description: 'test',
    type: 'expense',
    ...overrides,
  };
}

describe('report-utils money calculations', () => {
  it('prefers amountCents over amount when both are present', () => {
    const cents = getTransactionAmountCents(buildTxn({ amount: 99.99, amountCents: 1234 }));
    expect(cents).toBe(1234);
  });

  it('uses 0 when amountCents is missing', () => {
    const cents = getTransactionAmountCents(buildTxn({ amount: 10.01, amountCents: null }));
    expect(cents).toBe(0);
  });

  it('calculateSum aggregates by cents-first values', () => {
    const total = calculateSum([
      buildTxn({ amount: 12.34, amountCents: 1200 }),
      buildTxn({ amount: 0.55, amountCents: null }),
    ]);
    expect(total).toBeCloseTo(12, 8);
  });

  it('calculateByType groups using cents-first values', () => {
    const grouped = calculateByType([
      buildTxn({ type: 'income', amount: 0, amountCents: 10000 }),
      buildTxn({ type: 'expense', amount: 25.01, amountCents: null }),
      buildTxn({ type: 'transfer_in', amount: 0, amountCents: 501 }),
      buildTxn({ type: 'transfer_out', amount: 0, amountCents: 499 }),
    ]);

    expect(grouped.income).toBe(100);
    expect(grouped.expense).toBeCloseTo(0, 8);
    expect(grouped.transfer_in).toBeCloseTo(5.01, 8);
    expect(grouped.transfer_out).toBeCloseTo(4.99, 8);
  });

  it('getAccountBalanceValue prefers currentBalanceCents', () => {
    const balance = getAccountBalanceValue({
      currentBalance: 1.23,
      currentBalanceCents: 456,
    });
    expect(balance).toBe(4.56);
  });
});
