import { describe, expect, it } from 'vitest';

import {
  getFilteredTransactions,
  getTransferDestinationAccountId,
  getTransferDisplayProps,
  getTransferSourceAccountId,
} from '@/lib/transactions/transfer-display';
import type { TransactionListItem } from '@/lib/types/transactions-ui';

const transferOut: TransactionListItem = {
  id: 'tx-out',
  description: 'Transfer to savings',
  amount: 100,
  type: 'transfer_out',
  date: '2026-02-18',
  accountId: 'acc-checking',
  transferId: 'acc-savings',
  transferSourceAccountId: 'acc-checking',
  transferDestinationAccountId: 'acc-savings',
};

const transferIn: TransactionListItem = {
  id: 'tx-in',
  description: 'Transfer from checking',
  amount: 100,
  type: 'transfer_in',
  date: '2026-02-18',
  accountId: 'acc-savings',
  transferId: 'tx-out',
  transferSourceAccountId: 'acc-checking',
  transferDestinationAccountId: 'acc-savings',
};

describe('transfer-display helpers', () => {
  it('resolves explicit source and destination account IDs', () => {
    expect(getTransferSourceAccountId(transferOut, [transferOut, transferIn])).toBe('acc-checking');
    expect(getTransferDestinationAccountId(transferOut)).toBe('acc-savings');

    expect(getTransferSourceAccountId(transferIn, [transferOut, transferIn])).toBe('acc-checking');
    expect(getTransferDestinationAccountId(transferIn)).toBe('acc-savings');
  });

  it('deduplicates paired transfers in combined mode', () => {
    const filtered = getFilteredTransactions(
      [transferOut, transferIn],
      {
        accountIdFromUrl: null,
        filterAccountIds: [],
        combinedTransferView: true,
      }
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('tx-out');
  });

  it('keeps both paired transfers when combined mode is disabled', () => {
    const filtered = getFilteredTransactions(
      [transferOut, transferIn],
      {
        accountIdFromUrl: null,
        filterAccountIds: [],
        combinedTransferView: false,
      }
    );

    expect(filtered).toHaveLength(2);
  });

  it('returns transfer color/sign metadata for filtered transfer_out', () => {
    const display = getTransferDisplayProps(transferOut, {
      accountIdFromUrl: null,
      filterAccountIds: ['acc-checking'],
      combinedTransferView: true,
      allTransactions: [transferOut, transferIn],
    });

    expect(display.effectiveType).toBe('expense');
    expect(display.sign).toBe('-');
  });
});
