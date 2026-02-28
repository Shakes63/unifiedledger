import type { TransactionListItem } from '@/lib/types/transactions-ui';

import type { FilterTransferOptions } from '@/lib/transactions/transfer-display-types';

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

export function filterTransferTransactions(
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
