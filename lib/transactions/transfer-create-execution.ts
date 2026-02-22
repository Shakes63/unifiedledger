import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { resolveAccountEntityId } from '@/lib/household/entities';
import { getScopedTransferAccountOrThrow } from '@/lib/transactions/transfer-update-account-access';
import { persistCreatedTransferPair } from '@/lib/transactions/transfer-create-persistence';

export async function executeCreateCanonicalTransferPair({
  userId,
  householdId,
  fromAccountId,
  toAccountId,
  amountCents,
  feesCents,
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
}: {
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  feesCents: number;
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
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const totalDebitCents = amountCents + feesCents;

  await runInDatabaseTransaction(async (tx) => {
    const [fromAccount, toAccount] = await Promise.all([
      getScopedTransferAccountOrThrow(tx, {
        accountId: fromAccountId,
        userId,
        householdId,
        label: 'Source',
      }),
      getScopedTransferAccountOrThrow(tx, {
        accountId: toAccountId,
        userId,
        householdId,
        label: 'Destination',
      }),
    ]);
    const [fromEntityId, toEntityId] = await Promise.all([
      resolveAccountEntityId(householdId, userId, fromAccount.entityId),
      resolveAccountEntityId(householdId, userId, toAccount.entityId),
    ]);

    await persistCreatedTransferPair({
      tx,
      userId,
      householdId,
      fromAccount,
      toAccount,
      fromAccountId,
      toAccountId,
      amountCents,
      feesCents,
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
    });
  });
}
