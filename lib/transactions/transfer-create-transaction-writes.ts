import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { insertTransactionMovement } from '@/lib/transactions/money-movement-service';

type TransferTx = Parameters<Parameters<typeof runInDatabaseTransaction>[0]>[0];

export async function insertCreatedTransferTransactions({
  tx,
  userId,
  householdId,
  fromAccountId,
  toAccountId,
  amountCents,
  totalDebitCents,
  date,
  description,
  notes,
  isPending,
  isBalanceTransfer,
  savingsGoalId,
  offlineId,
  syncStatus,
  transferGroupId,
  fromTransactionId,
  toTransactionId,
  fromEntityId,
  toEntityId,
  nowIso,
}: {
  tx: TransferTx;
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  totalDebitCents: number;
  date: string;
  description: string;
  notes: string | null;
  isPending: boolean;
  isBalanceTransfer: boolean;
  savingsGoalId: string | null;
  offlineId: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  transferGroupId: string;
  fromTransactionId: string;
  toTransactionId: string;
  fromEntityId: string;
  toEntityId: string;
  nowIso: string;
}): Promise<void> {
  await insertTransactionMovement(tx, {
    id: fromTransactionId,
    userId,
    householdId,
    entityId: fromEntityId,
    accountId: fromAccountId,
    categoryId: null,
    merchantId: null,
    date,
    amountCents: totalDebitCents,
    description,
    notes,
    type: 'transfer_out',
    transferId: transferGroupId,
    transferGroupId,
    pairedTransactionId: toTransactionId,
    transferSourceAccountId: fromAccountId,
    transferDestinationAccountId: toAccountId,
    isPending,
    isBalanceTransfer,
    offlineId,
    syncStatus,
    syncedAt: syncStatus === 'synced' ? nowIso : null,
    syncAttempts: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  await insertTransactionMovement(tx, {
    id: toTransactionId,
    userId,
    householdId,
    entityId: toEntityId,
    accountId: toAccountId,
    categoryId: null,
    merchantId: null,
    savingsGoalId,
    date,
    amountCents,
    description,
    notes,
    type: 'transfer_in',
    transferId: transferGroupId,
    transferGroupId,
    pairedTransactionId: fromTransactionId,
    transferSourceAccountId: fromAccountId,
    transferDestinationAccountId: toAccountId,
    isPending,
    isBalanceTransfer,
    offlineId: offlineId ? `${offlineId}_in` : null,
    syncStatus,
    syncedAt: syncStatus === 'synced' ? nowIso : null,
    syncAttempts: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
}
