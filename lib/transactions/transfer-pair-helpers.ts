import { and, eq, ne } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';

type DbClient = typeof db;

export interface FindPairedTransferTransactionParams {
  tx: DbClient;
  transaction: typeof transactions.$inferSelect;
  userId: string;
  householdId: string;
}

export function isTransferType(type: string | null | undefined): boolean {
  return type === 'transfer_out' || type === 'transfer_in';
}

export function resolveTransferRoles(
  txA: typeof transactions.$inferSelect,
  txB: typeof transactions.$inferSelect
): {
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
} {
  if (txA.type === 'expense' && txB.type === 'income') {
    return { transferOut: txA, transferIn: txB };
  }

  if (txA.type === 'income' && txB.type === 'expense') {
    return { transferOut: txB, transferIn: txA };
  }

  if (txA.type === 'transfer_out' && txB.type === 'transfer_in') {
    return { transferOut: txA, transferIn: txB };
  }

  if (txA.type === 'transfer_in' && txB.type === 'transfer_out') {
    return { transferOut: txB, transferIn: txA };
  }

  throw new Error('Transactions must be opposite flow types (expense/income or transfer_out/transfer_in)');
}

export async function findPairedTransferTransaction({
  tx,
  transaction,
  userId,
  householdId,
}: FindPairedTransferTransactionParams): Promise<typeof transactions.$inferSelect | null> {
  if (transaction.pairedTransactionId) {
    const paired = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transaction.pairedTransactionId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);
    if (paired.length > 0) return paired[0];
  }

  if (transaction.transferGroupId) {
    const paired = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.transferGroupId, transaction.transferGroupId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId),
          ne(transactions.id, transaction.id)
        )
      )
      .limit(1);
    if (paired.length > 0) return paired[0];
  }

  return null;
}
