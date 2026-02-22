import { eq } from 'drizzle-orm';

import { transactions } from '@/lib/db/schema';
import { adjustTargetAccountBalance } from '@/lib/transactions/transaction-convert-write-balance';
import type { MoneyTx } from '@/lib/transactions/transaction-convert-write-types';

export async function updateConvertedTransactionRecord({
  tx,
  id,
  transferType,
  transferGroupId,
  pairedTransactionId,
  transferSourceAccountId,
  transferDestinationAccountId,
  description,
  nowIso,
}: {
  tx: MoneyTx;
  id: string;
  transferType: 'transfer_out' | 'transfer_in';
  transferGroupId: string;
  pairedTransactionId: string;
  transferSourceAccountId: string;
  transferDestinationAccountId: string;
  description: string;
  nowIso: string;
}): Promise<void> {
  await tx
    .update(transactions)
    .set({
      type: transferType,
      categoryId: null,
      merchantId: null,
      transferId: transferGroupId,
      transferGroupId,
      pairedTransactionId,
      transferSourceAccountId,
      transferDestinationAccountId,
      description,
      updatedAt: nowIso,
    })
    .where(eq(transactions.id, id));
}

export async function applyTargetBalanceDelta({
  tx,
  targetAccountId,
  userId,
  householdId,
  amountDeltaCents,
}: {
  tx: MoneyTx;
  targetAccountId: string;
  userId: string;
  householdId: string;
  amountDeltaCents: number;
}): Promise<void> {
  await adjustTargetAccountBalance({
    tx,
    targetAccountId,
    userId,
    householdId,
    amountDeltaCents,
  });
}
