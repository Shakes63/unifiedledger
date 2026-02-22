import { and, eq } from 'drizzle-orm';

import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { transfers } from '@/lib/db/schema';
import {
  insertTransferMovement,
} from '@/lib/transactions/money-movement-service';
import { applyCreatedTransferAccountUpdates } from '@/lib/transactions/transfer-create-account-updates';
import { insertCreatedTransferTransactions } from '@/lib/transactions/transfer-create-transaction-writes';

export async function persistCreatedTransferPair({
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
}: {
  tx: Parameters<Parameters<typeof runInDatabaseTransaction>[0]>[0];
  userId: string;
  householdId: string;
  fromAccount: { usageCount: number | null; currentBalanceCents: number | null };
  toAccount: { usageCount: number | null; currentBalanceCents: number | null };
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  feesCents: number;
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
  await insertCreatedTransferTransactions({
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
  });

  await applyCreatedTransferAccountUpdates({
    tx,
    userId,
    householdId,
    fromAccount,
    toAccount,
    fromAccountId,
    toAccountId,
    totalDebitCents,
    amountCents,
    nowIso,
  });

  if ('delete' in tx && typeof tx.delete === 'function') {
    await tx
      .delete(transfers)
      .where(
        and(
          eq(transfers.id, transferGroupId),
          eq(transfers.userId, userId),
          eq(transfers.householdId, householdId)
        )
      );
  }

  await insertTransferMovement(tx, {
    id: transferGroupId,
    userId,
    householdId,
    fromAccountId,
    toAccountId,
    amountCents,
    feesCents,
    description,
    date,
    status: 'completed',
    fromTransactionId,
    toTransactionId,
    notes,
    createdAt: nowIso,
  });
}
