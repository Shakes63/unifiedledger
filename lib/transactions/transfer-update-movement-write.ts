import { and, eq } from 'drizzle-orm';

import { transactions, transfers } from '@/lib/db/schema';
import { buildTransferMoneyFields } from '@/lib/transactions/money-movement-service';

type TxClient = { update: typeof import('@/lib/db').db.update };

export async function writeUpdatedTransferMovement({
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
}: {
  tx: TxClient;
  transferGroupId: string;
  userId: string;
  householdId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  nextTransferAmountCents: number;
  nextFeesCents: number;
  nextDescription: string;
  nextDate: string;
  nextNotes: string | null;
  nextIsPending: boolean;
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
}) {
  await tx
    .update(transfers)
    .set({
      fromAccountId: nextSourceAccountId,
      toAccountId: nextDestinationAccountId,
      ...buildTransferMoneyFields(nextTransferAmountCents, nextFeesCents),
      description: nextDescription,
      date: nextDate,
      notes: nextNotes,
      status: nextIsPending ? 'pending' : 'completed',
      fromTransactionId: transferOut.id,
      toTransactionId: transferIn.id,
    })
    .where(
      and(
        eq(transfers.id, transferGroupId),
        eq(transfers.userId, userId),
        eq(transfers.householdId, householdId)
      )
    );
}
