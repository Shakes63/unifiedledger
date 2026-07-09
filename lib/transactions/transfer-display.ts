/**
 * Display helpers for rendering transfer legs in the transactions list
 * (source/destination resolution, labels, filtering).
 *
 * Consolidated from 5 single-use shim files (types / branch-props / props /
 * filtering / head) during the post-audit cleanup; behavior is unchanged.
 */
import { type TransactionListItem } from '@/lib/types/transactions-ui';

// ---------------------------------------------------------------------------
// from transfer-display-types.ts
// ---------------------------------------------------------------------------
interface TransferDisplayOptions {
  accountIdFromUrl: string | null;
  filterAccountIds: string[];
  combinedTransferView: boolean;
  allTransactions: TransactionListItem[];
}

interface FilterTransferOptions {
  accountIdFromUrl: string | null;
  filterAccountIds: string[];
  combinedTransferView: boolean;
}

// ---------------------------------------------------------------------------
// from transfer-display-branch-props.ts
// ---------------------------------------------------------------------------
function transferResult(color: string, sign: string, effectiveType: 'income' | 'expense' | 'transfer') {
  return { color, sign, effectiveType };
}

function resolveNoFilterTransferProps({
  txType,
  combinedTransferView,
}: {
  txType: string;
  combinedTransferView: boolean;
}) {
  if (combinedTransferView) {
    return transferResult('var(--color-transfer)', '', 'transfer');
  }
  if (txType === 'transfer_out') {
    return transferResult('var(--color-expense)', '-', 'expense');
  }
  if (txType === 'transfer_in') {
    return transferResult('var(--color-income)', '+', 'income');
  }
  return transferResult('var(--color-transfer)', '', 'transfer');
}

function resolveTransferOutProps({
  transaction,
  combinedTransferView,
  inFilter,
  getTransferSourceAccountId,
  getTransferDestinationAccountId,
  allTransactions,
}: {
  transaction: TransactionListItem;
  combinedTransferView: boolean;
  inFilter: (accountId?: string | null) => boolean;
  getTransferSourceAccountId: (transaction: TransactionListItem, txs: TransactionListItem[]) => string | null;
  getTransferDestinationAccountId: (transaction: TransactionListItem) => string | null;
  allTransactions: TransactionListItem[];
}) {
  const sourceInFilter = inFilter(getTransferSourceAccountId(transaction, allTransactions));
  const destinationInFilter = inFilter(getTransferDestinationAccountId(transaction));

  if (sourceInFilter && destinationInFilter) {
    return combinedTransferView
      ? transferResult('var(--color-transfer)', '', 'transfer')
      : transferResult('var(--color-expense)', '-', 'expense');
  }
  if (sourceInFilter) {
    return transferResult('var(--color-expense)', '-', 'expense');
  }
  if (destinationInFilter) {
    return transferResult('var(--color-income)', '+', 'income');
  }
  return transferResult('var(--color-transfer)', '', 'transfer');
}

function resolveTransferInProps({
  transaction,
  combinedTransferView,
  inFilter,
  getTransferSourceAccountId,
  allTransactions,
}: {
  transaction: TransactionListItem;
  combinedTransferView: boolean;
  inFilter: (accountId?: string | null) => boolean;
  getTransferSourceAccountId: (transaction: TransactionListItem, txs: TransactionListItem[]) => string | null;
  allTransactions: TransactionListItem[];
}) {
  const destinationInFilter = inFilter(String(transaction.accountId));
  const sourceInFilter = inFilter(getTransferSourceAccountId(transaction, allTransactions));

  if (sourceInFilter && destinationInFilter) {
    return combinedTransferView
      ? transferResult('var(--color-transfer)', '', 'transfer')
      : transferResult('var(--color-income)', '+', 'income');
  }
  if (destinationInFilter) {
    return transferResult('var(--color-income)', '+', 'income');
  }
  if (sourceInFilter) {
    return transferResult('var(--color-expense)', '-', 'expense');
  }
  return transferResult('var(--color-transfer)', '', 'transfer');
}

function resolveDefaultTransferProps() {
  return transferResult('var(--color-transfer)', '', 'transfer');
}

// ---------------------------------------------------------------------------
// from transfer-display-props.ts
// ---------------------------------------------------------------------------
function getTransferDisplayPropsForTransaction(
  transaction: TransactionListItem,
  options: TransferDisplayOptions,
  getTransferSourceAccountId: (transaction: TransactionListItem, txs: TransactionListItem[]) => string | null,
  getTransferDestinationAccountId: (transaction: TransactionListItem) => string | null
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
    return resolveNoFilterTransferProps({
      txType,
      combinedTransferView: options.combinedTransferView,
    });
  }

  const filteredIds = filteredAccountIds.map((id) => String(id));
  const isAccountInFilter = (accountId?: string | null) =>
    Boolean(accountId && filteredIds.includes(String(accountId)));

  if (txType === 'transfer_out') {
    return resolveTransferOutProps({
      transaction,
      combinedTransferView: options.combinedTransferView,
      inFilter: isAccountInFilter,
      getTransferSourceAccountId,
      getTransferDestinationAccountId,
      allTransactions: options.allTransactions,
    });
  }

  if (txType === 'transfer_in') {
    return resolveTransferInProps({
      transaction,
      combinedTransferView: options.combinedTransferView,
      inFilter: isAccountInFilter,
      getTransferSourceAccountId,
      allTransactions: options.allTransactions,
    });
  }

  return resolveDefaultTransferProps();
}

// ---------------------------------------------------------------------------
// from transfer-display-filtering.ts
// ---------------------------------------------------------------------------
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

  return `derived:${sourceId || 'unknown'}|${destinationId || 'unknown'}|${tx.date}|${tx.amount}`;
}

function filterTransferTransactions(
  txs: TransactionListItem[],
  options: FilterTransferOptions,
  getTransferSourceAccountId: (transaction: TransactionListItem, txs: TransactionListItem[]) => string | null,
  getTransferDestinationAccountId: (transaction: TransactionListItem) => string | null
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

// ---------------------------------------------------------------------------
// from transfer-display.ts
// ---------------------------------------------------------------------------
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

export function getTransferDisplayProps(
  transaction: TransactionListItem,
  options: TransferDisplayOptions
): {
  color: string;
  sign: string;
  effectiveType: 'income' | 'expense' | 'transfer';
} {
  return getTransferDisplayPropsForTransaction(
    transaction,
    options,
    getTransferSourceAccountId,
    getTransferDestinationAccountId
  );
}

export function getFilteredTransactions(
  txs: TransactionListItem[],
  options: FilterTransferOptions
): TransactionListItem[] {
  return filterTransferTransactions(
    txs,
    options,
    getTransferSourceAccountId,
    getTransferDestinationAccountId
  );
}
