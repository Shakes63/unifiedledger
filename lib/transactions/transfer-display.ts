import type { TransactionListItem } from '@/lib/types/transactions-ui';

export function getTransferSourceAccountId(
  transaction: TransactionListItem,
  txs: TransactionListItem[]
): string | null {
  if (transaction.transferSourceAccountId) {
    return String(transaction.transferSourceAccountId);
  }

  if (transaction.type === 'transfer_out') {
    return String(transaction.accountId);
  }

  if (transaction.type === 'transfer_in') {
    if (transaction.pairedTransactionId) {
      const pairedTx = txs.find((tx) => tx.id === transaction.pairedTransactionId);
      if (pairedTx) {
        return String(pairedTx.accountId);
      }
    }

    if (transaction.transferGroupId) {
      const pairedTx = txs.find(
        (tx) =>
          tx.transferGroupId === transaction.transferGroupId &&
          tx.id !== transaction.id &&
          tx.type === 'transfer_out'
      );
      if (pairedTx) {
        return String(pairedTx.accountId);
      }
    }

    if (transaction.transferId) {
      const pairedTx = txs.find((tx) => tx.id === transaction.transferId);
      if (pairedTx) {
        return String(pairedTx.accountId);
      }
    }

    // Legacy fallback for historical converted rows.
    if (transaction.merchantId) {
      return String(transaction.merchantId);
    }
  }

  return null;
}

export function getTransferDestinationAccountId(
  transaction: TransactionListItem
): string | null {
  if (transaction.transferDestinationAccountId) {
    return String(transaction.transferDestinationAccountId);
  }

  if (transaction.type === 'transfer_out') {
    return null;
  }

  if (transaction.type === 'transfer_in') {
    return String(transaction.accountId);
  }

  return null;
}

interface TransferDisplayOptions {
  accountIdFromUrl: string | null;
  filterAccountIds: string[];
  combinedTransferView: boolean;
  allTransactions: TransactionListItem[];
}

export function getTransferDisplayProps(
  transaction: TransactionListItem,
  options: TransferDisplayOptions
): {
  color: string;
  sign: string;
  effectiveType: 'income' | 'expense' | 'transfer';
} {
  const filteredAccountIds = options.accountIdFromUrl
    ? [options.accountIdFromUrl]
    : options.filterAccountIds;

  const txType = String(transaction.type).trim();

  if (filteredAccountIds.length === 0) {
    if (options.combinedTransferView) {
      return {
        color: 'var(--color-transfer)',
        sign: '',
        effectiveType: 'transfer',
      };
    }

    if (txType === 'transfer_out') {
      return {
        color: 'var(--color-expense)',
        sign: '-',
        effectiveType: 'expense',
      };
    }

    if (txType === 'transfer_in') {
      return {
        color: 'var(--color-income)',
        sign: '+',
        effectiveType: 'income',
      };
    }

    return {
      color: 'var(--color-transfer)',
      sign: '',
      effectiveType: 'transfer',
    };
  }

  const filteredIds = filteredAccountIds.map((id) => String(id));
  const isAccountInFilter = (accountId?: string | null) =>
    Boolean(accountId && filteredIds.includes(String(accountId)));

  if (txType === 'transfer_out') {
    const sourceAccountId = getTransferSourceAccountId(transaction, options.allTransactions);
    const destinationAccountId = getTransferDestinationAccountId(transaction);

    const sourceInFilter = isAccountInFilter(sourceAccountId);
    const destinationInFilter = isAccountInFilter(destinationAccountId);

    if (sourceInFilter && destinationInFilter) {
      if (options.combinedTransferView) {
        return {
          color: 'var(--color-transfer)',
          sign: '',
          effectiveType: 'transfer',
        };
      }
      return {
        color: 'var(--color-expense)',
        sign: '-',
        effectiveType: 'expense',
      };
    }

    if (sourceInFilter) {
      return {
        color: 'var(--color-expense)',
        sign: '-',
        effectiveType: 'expense',
      };
    }

    if (destinationInFilter) {
      return {
        color: 'var(--color-income)',
        sign: '+',
        effectiveType: 'income',
      };
    }

    return {
      color: 'var(--color-transfer)',
      sign: '',
      effectiveType: 'transfer',
    };
  }

  if (txType === 'transfer_in') {
    const destinationAccountId = String(transaction.accountId);
    const sourceAccountId = getTransferSourceAccountId(transaction, options.allTransactions);

    const sourceInFilter = isAccountInFilter(sourceAccountId);
    const destinationInFilter = isAccountInFilter(destinationAccountId);

    if (sourceInFilter && destinationInFilter) {
      if (options.combinedTransferView) {
        return {
          color: 'var(--color-transfer)',
          sign: '',
          effectiveType: 'transfer',
        };
      }
      return {
        color: 'var(--color-income)',
        sign: '+',
        effectiveType: 'income',
      };
    }

    if (destinationInFilter) {
      return {
        color: 'var(--color-income)',
        sign: '+',
        effectiveType: 'income',
      };
    }

    if (sourceInFilter) {
      return {
        color: 'var(--color-expense)',
        sign: '-',
        effectiveType: 'expense',
      };
    }

    return {
      color: 'var(--color-transfer)',
      sign: '',
      effectiveType: 'transfer',
    };
  }

  return {
    color: 'var(--color-transfer)',
    sign: '',
    effectiveType: 'transfer',
  };
}

interface FilterTransferOptions {
  accountIdFromUrl: string | null;
  filterAccountIds: string[];
  combinedTransferView: boolean;
}

function getTransferPairKey(
  tx: TransactionListItem,
  sourceId: string | null,
  destinationId: string | null
): string {
  if (tx.transferGroupId) {
    return `group:${tx.transferGroupId}`;
  }

  if (tx.pairedTransactionId) {
    return `pair:${[tx.id, tx.pairedTransactionId].sort().join('|')}`;
  }

  return `fallback:${sourceId || 'unknown'}|${destinationId || 'unknown'}|${tx.date}|${tx.amount}`;
}

export function getFilteredTransactions(
  txs: TransactionListItem[],
  options: FilterTransferOptions
): TransactionListItem[] {
  const filteredAccountIds = options.accountIdFromUrl
    ? [options.accountIdFromUrl]
    : options.filterAccountIds;
  const filteredIds = filteredAccountIds.map((id) => String(id));

  const seenTransferPairs = new Set<string>();
  const filtered: TransactionListItem[] = [];

  const areBothAccountsInFilter = (sourceId: string, destId: string): boolean => {
    if (filteredIds.length === 0) return false;
    return filteredIds.includes(sourceId) && filteredIds.includes(destId);
  };

  for (const tx of txs) {
    const txType = String(tx.type).trim();

    if (txType !== 'transfer_out' && txType !== 'transfer_in') {
      filtered.push(tx);
      continue;
    }

    if (txType === 'transfer_out') {
      const sourceId = getTransferSourceAccountId(tx, txs);
      const destId = getTransferDestinationAccountId(tx);

      if (!sourceId || !destId) {
        filtered.push(tx);
        continue;
      }

      const pairKey = getTransferPairKey(tx, sourceId, destId);
      const bothAccountsInFilter = areBothAccountsInFilter(sourceId, destId);
      const shouldDeduplicateThisTransfer = bothAccountsInFilter || filteredIds.length === 0
        ? options.combinedTransferView
        : false;

      if (shouldDeduplicateThisTransfer) {
        if (!seenTransferPairs.has(pairKey)) {
          seenTransferPairs.add(pairKey);
          filtered.push(tx);
        }
      } else {
        filtered.push(tx);
      }
      continue;
    }

    const destId = getTransferDestinationAccountId(tx);
    const sourceId = getTransferSourceAccountId(tx, txs);

    if (!sourceId || !destId) {
      filtered.push(tx);
      continue;
    }

    const pairKey = getTransferPairKey(tx, sourceId, destId);
    const bothAccountsInFilter = areBothAccountsInFilter(sourceId, destId);
    const shouldDeduplicateThisTransfer = bothAccountsInFilter || filteredIds.length === 0
      ? options.combinedTransferView
      : false;

    if (shouldDeduplicateThisTransfer) {
      if (seenTransferPairs.has(pairKey)) {
        continue;
      }
      seenTransferPairs.add(pairKey);
      filtered.push(tx);
    } else {
      filtered.push(tx);
    }
  }

  return filtered;
}
