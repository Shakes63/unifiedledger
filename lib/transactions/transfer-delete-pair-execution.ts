import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions, transfers } from '@/lib/db/schema';
import {
  revertTransferPairBalances,
} from '@/lib/transactions/transfer-delete-account-updates';
import { resolveTransferDeleteContext } from '@/lib/transactions/transfer-delete-context';
import { reverseTransactionSideEffects } from '@/lib/transactions/transaction-side-effect-reversal';

type DbClient = typeof db;

export async function deleteTransferPairRecordsAndRevertBalances(
  tx: DbClient,
  {
    userId,
    householdId,
    txRecord,
    paired,
  }: {
    userId: string;
    householdId: string;
    txRecord: typeof transactions.$inferSelect;
    paired: typeof transactions.$inferSelect | null;
  }
): Promise<void> {
  const transferGroupId =
    txRecord.transferGroupId ||
    paired?.transferGroupId ||
    (txRecord.transferId && txRecord.transferId !== txRecord.accountId ? txRecord.transferId : null);
  const transferRecord = transferGroupId
    ? await tx
        .select()
        .from(transfers)
        .where(
          and(
            eq(transfers.id, transferGroupId),
            eq(transfers.userId, userId),
            eq(transfers.householdId, householdId)
          )
        )
        .limit(1)
    : [];
  const deleteContext = resolveTransferDeleteContext({
    txRecord,
    paired,
    transferRows: transferRecord,
  });

  await revertTransferPairBalances({
    tx,
    userId,
    householdId,
    sourceAccountId: deleteContext.sourceAccountId,
    destinationAccountId: deleteContext.destinationAccountId,
    transferAmountCents: deleteContext.transferAmountCents,
    totalDebitCents: deleteContext.totalDebitCents,
  });

  // Reverse any goal contribution / bill payment / debt payment linked to either
  // leg of the pair before deleting them (C-LIFE-2, H-BILL-1). A credit-card
  // payment transfer, for example, links a bill payment to the transfer_in leg.
  await reverseTransactionSideEffects(tx, {
    transactionId: txRecord.id,
    userId,
    householdId,
  });
  if (paired) {
    await reverseTransactionSideEffects(tx, {
      transactionId: paired.id,
      userId,
      householdId,
    });
  }

  if (paired) {
    await tx
      .delete(transactions)
      .where(
        and(
          eq(transactions.id, paired.id),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      );
  }

  await tx
    .delete(transactions)
    .where(
      and(
        eq(transactions.id, txRecord.id),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      )
    );

  if (transferGroupId) {
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
}
