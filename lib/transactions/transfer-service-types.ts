export interface CreateCanonicalTransferPairParams {
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  feesCents?: number;
  date: string;
  description: string;
  notes?: string | null;
  isPending?: boolean;
  isBalanceTransfer?: boolean;
  savingsGoalId?: string | null;
  offlineId?: string | null;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  transferGroupId?: string;
  fromTransactionId?: string;
  toTransactionId?: string;
}

export interface LinkExistingTransactionsAsTransferParams {
  userId: string;
  householdId: string;
  firstTransactionId: string;
  secondTransactionId: string;
  transferGroupId?: string;
}

export interface UpdateCanonicalTransferPairParams {
  userId: string;
  householdId: string;
  transactionId: string;
  amountCents?: number;
  date?: string;
  description?: string;
  notes?: string | null;
  isPending?: boolean;
  sourceAccountId?: string;
  destinationAccountId?: string;
}
