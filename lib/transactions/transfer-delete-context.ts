import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions, transfers } from '@/lib/db/schema';
import {
  getTransactionAmountCents,
  getTransferAmountCents,
  getTransferFeesCents,
} from '@/lib/transactions/money-movement-service';

type DbClient = typeof db;

export async function loadTransferDeleteContext({
  tx,
  userId,
  householdId,
  transactionId,
}: {
  tx: DbClient;
  userId: string;
  householdId: string;
  transactionId: string;
}): Promise<{
  txRecord: typeof transactions.$inferSelect;
  paired: typeof transactions.$inferSelect | null;
}> {
  const txRecordRows = await tx
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      )
    )
    .limit(1);
  if (txRecordRows.length === 0) {
    throw new Error('Transfer transaction not found');
  }

  const txRecord = txRecordRows[0];

  const paired = txRecord.pairedTransactionId
    ? (
        await tx
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.id, txRecord.pairedTransactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          )
          .limit(1)
      )[0] ?? null
    : null;

  return { txRecord, paired };
}

export function resolveTransferDeleteContext({
  txRecord,
  paired,
  transferRows,
}: {
  txRecord: typeof transactions.$inferSelect;
  paired: typeof transactions.$inferSelect | null;
  transferRows: Array<typeof transfers.$inferSelect>;
}): {
  transferOut: typeof transactions.$inferSelect | null;
  transferIn: typeof transactions.$inferSelect | null;
  transferGroupId: string | null;
  transferAmountCents: number;
  totalDebitCents: number;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
} {
  const transferOut =
    txRecord.type === 'transfer_out'
      ? txRecord
      : paired && paired.type === 'transfer_out'
        ? paired
        : null;
  const transferIn =
    txRecord.type === 'transfer_in'
      ? txRecord
      : paired && paired.type === 'transfer_in'
        ? paired
        : null;

  const transferGroupId =
    txRecord.transferGroupId ||
    paired?.transferGroupId ||
    (txRecord.transferId && txRecord.transferId !== txRecord.accountId ? txRecord.transferId : null);

  const transferRecord = transferRows[0];

  const transferAmountCents = transferRecord
    ? getTransferAmountCents(transferRecord)
    : transferIn
      ? getTransactionAmountCents(transferIn)
      : transferOut
        ? getTransactionAmountCents(transferOut)
        : 0;

  const totalDebitCents = transferRecord
    ? transferAmountCents + getTransferFeesCents(transferRecord)
    : transferOut
      ? getTransactionAmountCents(transferOut)
      : transferAmountCents;

  const sourceAccountId =
    transferOut?.transferSourceAccountId ||
    transferOut?.accountId ||
    transferIn?.transferSourceAccountId ||
    null;
  const destinationAccountId =
    transferOut?.transferDestinationAccountId ||
    transferIn?.accountId ||
    transferIn?.transferDestinationAccountId ||
    null;

  return {
    transferOut,
    transferIn,
    transferGroupId,
    transferAmountCents,
    totalDebitCents,
    sourceAccountId,
    destinationAccountId,
  };
}
