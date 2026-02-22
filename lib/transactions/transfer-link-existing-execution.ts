import { and, eq } from 'drizzle-orm';

import { transactions, transfers } from '@/lib/db/schema';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { getTransactionAmountCents, insertTransferMovement } from '@/lib/transactions/money-movement-service';
import { resolveTransferRoles } from '@/lib/transactions/transfer-pair-helpers';

export async function executeLinkExistingTransferPair({
  userId,
  householdId,
  firstTransactionId,
  secondTransactionId,
  transferGroupId,
}: {
  userId: string;
  householdId: string;
  firstTransactionId: string;
  secondTransactionId: string;
  transferGroupId: string;
}): Promise<{ transferOutId: string; transferInId: string }> {
  const nowIso = new Date().toISOString();
  let transferOutId = '';
  let transferInId = '';

  await runInDatabaseTransaction(async (tx) => {
    const [first, second] = await Promise.all([
      tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, firstTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        )
        .limit(1),
      tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, secondTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        )
        .limit(1),
    ]);

    if (first.length === 0 || second.length === 0) {
      throw new Error('One or both transactions not found');
    }

    if (
      first[0].transferGroupId ||
      second[0].transferGroupId ||
      first[0].pairedTransactionId ||
      second[0].pairedTransactionId
    ) {
      throw new Error('One or both transactions are already linked as a transfer');
    }

    const { transferOut, transferIn } = resolveTransferRoles(first[0], second[0]);
    transferOutId = transferOut.id;
    transferInId = transferIn.id;
    const transferAmountCents = getTransactionAmountCents(transferOut);

    await tx
      .update(transactions)
      .set({
        type: 'transfer_out',
        categoryId: null,
        merchantId: null,
        transferId: transferGroupId,
        transferGroupId,
        pairedTransactionId: transferIn.id,
        transferSourceAccountId: transferOut.accountId,
        transferDestinationAccountId: transferIn.accountId,
        updatedAt: nowIso,
      })
      .where(eq(transactions.id, transferOut.id));

    await tx
      .update(transactions)
      .set({
        type: 'transfer_in',
        categoryId: null,
        merchantId: null,
        transferId: transferGroupId,
        transferGroupId,
        pairedTransactionId: transferOut.id,
        transferSourceAccountId: transferOut.accountId,
        transferDestinationAccountId: transferIn.accountId,
        updatedAt: nowIso,
      })
      .where(eq(transactions.id, transferIn.id));

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
      fromAccountId: transferOut.accountId,
      toAccountId: transferIn.accountId,
      amountCents: transferAmountCents,
      feesCents: 0,
      description: transferOut.description || transferIn.description || 'Transfer',
      date: transferOut.date,
      status: 'completed',
      fromTransactionId: transferOut.id,
      toTransactionId: transferIn.id,
      notes: transferOut.notes || transferIn.notes || null,
      createdAt: nowIso,
    });
  });

  return {
    transferOutId,
    transferInId,
  };
}
