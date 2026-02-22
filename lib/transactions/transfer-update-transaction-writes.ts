import { and, eq } from 'drizzle-orm';

import { transactions } from '@/lib/db/schema';
import { buildTransactionAmountFields } from '@/lib/transactions/money-movement-service';

type TxClient = { update: typeof import('@/lib/db').db.update };

export async function writeUpdatedTransferOutTransaction({
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
}: {
  tx: TxClient;
  userId: string;
  householdId: string;
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
  transferGroupId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  nextDate: string;
  nextTransferOutAmountCents: number;
  nextDescription: string;
  nextNotes: string | null;
  nextIsPending: boolean;
  nowIso: string;
}) {
  await tx
    .update(transactions)
    .set({
      accountId: nextSourceAccountId,
      categoryId: null,
      merchantId: null,
      transferId: transferGroupId,
      transferGroupId,
      pairedTransactionId: transferIn.id,
      transferSourceAccountId: nextSourceAccountId,
      transferDestinationAccountId: nextDestinationAccountId,
      date: nextDate,
      ...buildTransactionAmountFields(nextTransferOutAmountCents),
      description: nextDescription,
      notes: nextNotes,
      isPending: nextIsPending,
      type: 'transfer_out',
      updatedAt: nowIso,
    })
    .where(
      and(
        eq(transactions.id, transferOut.id),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      )
    );
}

export async function writeUpdatedTransferInTransaction({
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
}: {
  tx: TxClient;
  userId: string;
  householdId: string;
  transferIn: typeof transactions.$inferSelect;
  transferOut: typeof transactions.$inferSelect;
  transferGroupId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  nextDate: string;
  nextTransferAmountCents: number;
  nextDescription: string;
  nextNotes: string | null;
  nextIsPending: boolean;
  nowIso: string;
}) {
  await tx
    .update(transactions)
    .set({
      accountId: nextDestinationAccountId,
      categoryId: null,
      merchantId: null,
      transferId: transferGroupId,
      transferGroupId,
      pairedTransactionId: transferOut.id,
      transferSourceAccountId: nextSourceAccountId,
      transferDestinationAccountId: nextDestinationAccountId,
      date: nextDate,
      ...buildTransactionAmountFields(nextTransferAmountCents),
      description: nextDescription,
      notes: nextNotes,
      isPending: nextIsPending,
      type: 'transfer_in',
      updatedAt: nowIso,
    })
    .where(
      and(
        eq(transactions.id, transferIn.id),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      )
    );
}
