import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { loadTransferUpdateContext } from '@/lib/transactions/transfer-update-context';
import { executeTransferPairUpdate } from '@/lib/transactions/transfer-update-execution';
import type { UpdateCanonicalTransferPairParams } from '@/lib/transactions/transfer-service-types';

export async function executeTransferUpdateOrchestration({
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
  let resultTransferGroupId = '';
  let resultTransferOutId = '';
  let resultTransferInId = '';
  let resultSourceAccountId = '';
  let resultDestinationAccountId = '';

  await runInDatabaseTransaction(async (tx) => {
    const {
      transferOut,
      transferIn,
      transferGroupId,
      transferRecord,
      currentTransferAmountCents,
      currentFeesCents,
      currentSourceAccountId,
      currentDestinationAccountId,
    } = await loadTransferUpdateContext(tx, {
      userId,
      householdId,
      transactionId,
    });

    const updated = await executeTransferPairUpdate(tx, {
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
      sourceAccountId: sourceAccountId ?? currentSourceAccountId,
      destinationAccountId: destinationAccountId ?? currentDestinationAccountId,
    });

    resultTransferGroupId = updated.transferGroupId;
    resultTransferOutId = updated.transferOutId;
    resultTransferInId = updated.transferInId;
    resultSourceAccountId = updated.sourceAccountId;
    resultDestinationAccountId = updated.destinationAccountId;
  });

  return {
    transferGroupId: resultTransferGroupId,
    transferOutId: resultTransferOutId,
    transferInId: resultTransferInId,
    sourceAccountId: resultSourceAccountId,
    destinationAccountId: resultDestinationAccountId,
  };
}
