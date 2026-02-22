import type { TransactionListItem } from '@/lib/types/transactions-ui';
import { filterTransferTransactions } from '@/lib/transactions/transfer-display-filtering';
import { getTransferDisplayPropsForTransaction } from '@/lib/transactions/transfer-display-props';
import type {
  FilterTransferOptions,
  TransferDisplayOptions,
} from '@/lib/transactions/transfer-display-types';

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
