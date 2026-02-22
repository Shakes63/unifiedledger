import { nanoid } from 'nanoid';

import { validateCanonicalTransferInput } from '@/lib/transactions/transfer-contract';
import { executeCreateCanonicalTransferPair } from '@/lib/transactions/transfer-create-execution';
import type { CreateCanonicalTransferPairParams } from '@/lib/transactions/transfer-service-types';

export async function executeTransferCreateOrchestration({
  userId,
  householdId,
  fromAccountId,
  toAccountId,
  amountCents,
  feesCents = 0,
  date,
  description,
  notes = null,
  isPending = false,
  isBalanceTransfer = false,
  savingsGoalId = null,
  offlineId = null,
  syncStatus = 'synced',
  transferGroupId: incomingTransferGroupId,
  fromTransactionId: incomingFromTransactionId,
  toTransactionId: incomingToTransactionId,
}: CreateCanonicalTransferPairParams): Promise<{
  transferGroupId: string;
  fromTransactionId: string;
  toTransactionId: string;
}> {
  const validated = validateCanonicalTransferInput({
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
    transferGroupId: incomingTransferGroupId,
    fromTransactionId: incomingFromTransactionId,
    toTransactionId: incomingToTransactionId,
  });

  const transferGroupId = incomingTransferGroupId ?? nanoid();
  const fromTransactionId = incomingFromTransactionId ?? nanoid();
  const toTransactionId = incomingToTransactionId ?? nanoid();

  await executeCreateCanonicalTransferPair({
    userId,
    householdId,
    fromAccountId: validated.fromAccountId,
    toAccountId: validated.toAccountId,
    amountCents: validated.amountCents,
    feesCents: validated.feesCents ?? 0,
    date: validated.date,
    description: validated.description,
    notes: validated.notes ?? null,
    isPending: validated.isPending ?? false,
    isBalanceTransfer: validated.isBalanceTransfer ?? false,
    savingsGoalId: validated.savingsGoalId ?? null,
    offlineId: validated.offlineId ?? null,
    syncStatus: validated.syncStatus ?? 'synced',
    transferGroupId,
    fromTransactionId,
    toTransactionId,
  });

  return {
    transferGroupId,
    fromTransactionId,
    toTransactionId,
  };
}
