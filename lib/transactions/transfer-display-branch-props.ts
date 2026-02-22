import type { TransactionListItem } from '@/lib/types/transactions-ui';

function transferResult(color: string, sign: string, effectiveType: 'income' | 'expense' | 'transfer') {
  return { color, sign, effectiveType };
}

export function resolveNoFilterTransferProps({
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

export function resolveTransferOutProps({
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

export function resolveTransferInProps({
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

export function resolveDefaultTransferProps() {
  return transferResult('var(--color-transfer)', '', 'transfer');
}
