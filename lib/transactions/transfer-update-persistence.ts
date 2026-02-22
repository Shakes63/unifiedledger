import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { transactions, transfers } from '@/lib/db/schema';
import {
  insertTransferMovement,
} from '@/lib/transactions/money-movement-service';
import {
  writeUpdatedTransferInTransaction,
  writeUpdatedTransferOutTransaction,
} from '@/lib/transactions/transfer-update-transaction-writes';
import {
  writeUpdatedTransferMovement,
} from '@/lib/transactions/transfer-update-movement-write';

export async function persistTransferPairUpdate({
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
}: {
  tx: Parameters<Parameters<typeof runInDatabaseTransaction>[0]>[0];
  userId: string;
  householdId: string;
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
  transferGroupId: string;
  transferRecord: Array<typeof transfers.$inferSelect>;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  nextTransferAmountCents: number;
  nextTransferOutAmountCents: number;
  nextFeesCents: number;
  nextDate: string;
  nextDescription: string;
  nextNotes: string | null;
  nextIsPending: boolean;
  nowIso: string;
}): Promise<void> {
  await writeUpdatedTransferOutTransaction({
    tx,
    userId,
    householdId,
    transferOut,
    transferIn,
    transferGroupId,
    nextSourceAccountId,
    nextDestinationAccountId,
    nextDate,
    nextTransferOutAmountCents,
    nextDescription,
    nextNotes,
    nextIsPending,
    nowIso,
  });

  await writeUpdatedTransferInTransaction({
    tx,
    userId,
    householdId,
    transferIn,
    transferOut,
    transferGroupId,
    nextSourceAccountId,
    nextDestinationAccountId,
    nextDate,
    nextTransferAmountCents,
    nextDescription,
    nextNotes,
    nextIsPending,
    nowIso,
  });

  if (transferRecord.length > 0) {
    await writeUpdatedTransferMovement({
      tx,
      transferGroupId,
      userId,
      householdId,
      nextSourceAccountId,
      nextDestinationAccountId,
      nextTransferAmountCents,
      nextFeesCents,
      nextDescription,
      nextDate,
      nextNotes,
      nextIsPending,
      transferOut,
      transferIn,
    });
    return;
  }

  await insertTransferMovement(tx, {
    id: transferGroupId,
    userId,
    householdId,
    fromAccountId: nextSourceAccountId,
    toAccountId: nextDestinationAccountId,
    amountCents: nextTransferAmountCents,
    feesCents: nextFeesCents,
    description: nextDescription,
    date: nextDate,
    status: nextIsPending ? 'pending' : 'completed',
    fromTransactionId: transferOut.id,
    toTransactionId: transferIn.id,
    notes: nextNotes,
    createdAt: nowIso,
  });
}
