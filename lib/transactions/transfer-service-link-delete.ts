import { nanoid } from 'nanoid';

import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { deleteTransferPairRecordsAndRevertBalances } from '@/lib/transactions/transfer-delete-pair-execution';
import { loadTransferDeleteContext } from '@/lib/transactions/transfer-delete-context';
import { executeLinkExistingTransferPair } from '@/lib/transactions/transfer-link-existing-execution';

export async function linkExistingTransferPair({
  userId,
  householdId,
  firstTransactionId,
  secondTransactionId,
  incomingTransferGroupId,
}: {
  userId: string;
  householdId: string;
  firstTransactionId: string;
  secondTransactionId: string;
  incomingTransferGroupId?: string;
}): Promise<{
  transferGroupId: string;
  transferOutId: string;
  transferInId: string;
}> {
  const transferGroupId = incomingTransferGroupId ?? nanoid();
  const { transferOutId, transferInId } = await executeLinkExistingTransferPair({
    userId,
    householdId,
    firstTransactionId,
    secondTransactionId,
    transferGroupId,
  });

  return {
    transferGroupId,
    transferOutId,
    transferInId,
  };
}

export async function deleteCanonicalTransferPair({
  userId,
  householdId,
  transactionId,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
}): Promise<void> {
  await runInDatabaseTransaction(async (tx) => {
    const { txRecord, paired } = await loadTransferDeleteContext({
      tx,
      userId,
      householdId,
      transactionId,
    });

    await deleteTransferPairRecordsAndRevertBalances(tx, {
      userId,
      householdId,
      txRecord,
      paired,
    });
  });
}
