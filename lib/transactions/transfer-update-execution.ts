import { loadScopedTransferAccountsById } from '@/lib/transactions/transfer-update-account-access';
import {
  applyTransferBalanceDeltas,
  buildNextTransferFields,
} from '@/lib/transactions/transfer-update-balance-application';
import {
  buildTransferUpdateResult,
  collectAffectedTransferAccountIds,
} from '@/lib/transactions/transfer-update-execution-helpers';
import {
  buildAccountBalanceDeltaById,
  buildTransferUpdateContext,
} from '@/lib/transactions/transfer-update-context-build';
import type {
  ExecuteTransferPairUpdateParams,
  TransferUpdateDbClient,
} from '@/lib/transactions/transfer-update-execution-types';
import { persistTransferPairUpdate } from '@/lib/transactions/transfer-update-persistence';

export async function executeTransferPairUpdate(
  tx: TransferUpdateDbClient,
  {
    userId,
    householdId,
    transferOut,
    transferIn,
    transferGroupId,
    transferRecord,
    currentTransferAmountCents,
    currentFeesCents,
    amountCents,
    date,
    description,
    notes,
    isPending,
    sourceAccountId,
    destinationAccountId,
  }: ExecuteTransferPairUpdateParams
) {
  const {
    nextTransferAmountCents,
    nextFeesCents,
    currentTransferOutAmountCents,
    nextTransferOutAmountCents,
    currentSourceAccountId,
    currentDestinationAccountId,
    nextSourceAccountId,
    nextDestinationAccountId,
  } = buildTransferUpdateContext({
    transferOut,
    transferIn,
    sourceAccountId,
    destinationAccountId,
    amountCents,
    currentTransferAmountCents,
    currentFeesCents,
  });

  if (nextSourceAccountId === nextDestinationAccountId) {
    throw new Error('Cannot transfer to the same account');
  }

  const affectedAccountIds = collectAffectedTransferAccountIds({
    currentSourceAccountId,
    currentDestinationAccountId,
    nextSourceAccountId,
    nextDestinationAccountId,
  });

  const accountsById = await loadScopedTransferAccountsById(tx, {
    accountIds: affectedAccountIds,
    userId,
    householdId,
  });
  const balanceDeltaByAccountId = buildAccountBalanceDeltaById({
    currentSourceAccountId,
    currentDestinationAccountId,
    nextSourceAccountId,
    nextDestinationAccountId,
    currentTransferOutAmountCents,
    currentTransferAmountCents,
    nextTransferOutAmountCents,
    nextTransferAmountCents,
  });

  await applyTransferBalanceDeltas({
    tx,
    accountsById,
    balanceDeltaByAccountId,
    userId,
    householdId,
  });

  const nowIso = new Date().toISOString();
  const { nextDate, nextDescription, nextNotes, nextIsPending } = buildNextTransferFields({
    transferOut,
    transferIn,
    date,
    description,
    notes,
    isPending,
  });

  await persistTransferPairUpdate({
    tx,
    userId,
    householdId,
    transferOut,
    transferIn,
    transferGroupId,
    transferRecord,
    nextSourceAccountId,
    nextDestinationAccountId,
    nextTransferAmountCents,
    nextTransferOutAmountCents,
    nextFeesCents,
    nextDate,
    nextDescription,
    nextNotes,
    nextIsPending,
    nowIso,
  });

  return buildTransferUpdateResult({
    transferGroupId,
    transferOut,
    transferIn,
    nextSourceAccountId,
    nextDestinationAccountId,
  });
}
