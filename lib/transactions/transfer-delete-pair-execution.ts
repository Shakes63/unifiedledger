import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions, transfers } from '@/lib/db/schema';
import {
  revertTransferPairBalances,
} from '@/lib/transactions/transfer-delete-account-updates';
import { resolveTransferDeleteContext } from '@/lib/transactions/transfer-delete-context';

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
