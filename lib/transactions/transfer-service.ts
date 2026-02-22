import { executeTransferCreateOrchestration } from '@/lib/transactions/transfer-create-orchestrator';
import {
  deleteCanonicalTransferPair,
  linkExistingTransferPair,
} from '@/lib/transactions/transfer-service-link-delete';
import { executeTransferUpdateOrchestration } from '@/lib/transactions/transfer-update-orchestrator';
import type {
  CreateCanonicalTransferPairParams,
  LinkExistingTransactionsAsTransferParams,
  UpdateCanonicalTransferPairParams,
} from '@/lib/transactions/transfer-service-types';

export async function createCanonicalTransferPair({
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
  return executeTransferCreateOrchestration({
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
}

export async function linkExistingTransactionsAsCanonicalTransfer({
  userId,
  householdId,
  firstTransactionId,
  secondTransactionId,
  transferGroupId: incomingTransferGroupId,
}: LinkExistingTransactionsAsTransferParams): Promise<{
  transferGroupId: string;
  transferOutId: string;
  transferInId: string;
}> {
  return linkExistingTransferPair({
    userId,
    householdId,
    firstTransactionId,
    secondTransactionId,
    incomingTransferGroupId,
  });
}

export async function updateCanonicalTransferPairByTransactionId({
  userId,
  householdId,
  transactionId,
  amountCents,
  date,
  description,
  notes,
  isPending,
  sourceAccountId,
  destinationAccountId,
}: UpdateCanonicalTransferPairParams): Promise<{
  transferGroupId: string;
  transferOutId: string;
  transferInId: string;
  sourceAccountId: string;
  destinationAccountId: string;
}> {
  return executeTransferUpdateOrchestration({
    userId,
    householdId,
    transactionId,
    amountCents,
    date,
    description,
    notes,
    isPending,
    sourceAccountId,
    destinationAccountId,
  });
}

export async function deleteCanonicalTransferPairByTransactionId({
  userId,
  householdId,
  transactionId,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
}): Promise<void> {
  await deleteCanonicalTransferPair({
    userId,
    householdId,
    transactionId,
  });
}
