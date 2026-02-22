import { insertTransactionMovement, insertTransferMovement } from '@/lib/transactions/money-movement-service';
import type { MoneyTx } from '@/lib/transactions/transaction-convert-write-types';

export async function insertPairedTransferTransaction({
  tx,
  id,
  userId,
  householdId,
  accountId,
  date,
  amountCents,
  description,
  notes,
  transferType,
  transferGroupId,
  pairedTransactionId,
  transferSourceAccountId,
  transferDestinationAccountId,
  isPending,
  nowIso,
}: {
  tx: MoneyTx;
  id: string;
  userId: string;
  householdId: string;
  accountId: string;
  date: string;
  amountCents: number;
  description: string;
  notes: string | null;
  transferType: 'transfer_in' | 'transfer_out';
  transferGroupId: string;
  pairedTransactionId: string;
  transferSourceAccountId: string;
  transferDestinationAccountId: string;
  isPending: boolean;
  nowIso: string;
}): Promise<void> {
  await insertTransactionMovement(tx, {
    id,
    userId,
    householdId,
    accountId,
    categoryId: null,
    merchantId: null,
    date,
    amountCents,
    description,
    notes,
    type: transferType,
    transferId: transferGroupId,
    transferGroupId,
    pairedTransactionId,
    transferSourceAccountId,
    transferDestinationAccountId,
    isPending,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
}

export async function insertCanonicalTransferRecord({
  tx,
  transferGroupId,
  userId,
  householdId,
  fromAccountId,
  toAccountId,
  amountCents,
  date,
  description,
  fromTransactionId,
  toTransactionId,
  notes,
  nowIso,
}: {
  tx: MoneyTx;
  transferGroupId: string;
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  date: string;
  description: string;
  fromTransactionId: string;
  toTransactionId: string;
  notes: string | null;
  nowIso: string;
}): Promise<void> {
  await insertTransferMovement(tx, {
    id: transferGroupId,
    userId,
    householdId,
    fromAccountId,
    toAccountId,
    amountCents,
    feesCents: 0,
    description,
    date,
    status: 'completed',
    fromTransactionId,
    toTransactionId,
    notes,
    createdAt: nowIso,
  });
}
