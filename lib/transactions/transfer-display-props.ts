import type { TransactionListItem } from '@/lib/types/transactions-ui';

import type { TransferDisplayOptions } from '@/lib/transactions/transfer-display-types';
import {
  resolveDefaultTransferProps,
  resolveNoFilterTransferProps,
  resolveTransferInProps,
  resolveTransferOutProps,
} from '@/lib/transactions/transfer-display-branch-props';

export function getTransferDisplayPropsForTransaction(
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
