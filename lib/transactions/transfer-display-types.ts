import type { TransactionListItem } from '@/lib/types/transactions-ui';

export interface TransferDisplayOptions {
  accountIdFromUrl: string | null;
  filterAccountIds: string[];
  combinedTransferView: boolean;
  allTransactions: TransactionListItem[];
}

export interface FilterTransferOptions {
  accountIdFromUrl: string | null;
  filterAccountIds: string[];
  combinedTransferView: boolean;
}
