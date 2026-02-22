import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import {
  getAccountBalanceCents,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';

type DbClient = typeof db;

export async function applyTransferBalanceDeltas({
  tx,
  accountsById,
  balanceDeltaByAccountId,
  userId,
  householdId,
}: {
  tx: DbClient;
  accountsById: Map<string, typeof accounts.$inferSelect>;
  balanceDeltaByAccountId: Map<string, number>;
  userId: string;
  householdId: string;
}): Promise<void> {
  for (const [accountId, delta] of balanceDeltaByAccountId.entries()) {
    if (delta === 0) {
      continue;
    }

    const account = accountsById.get(accountId);
    if (!account) {
      throw new Error('Transfer account not found');
    }

    await updateScopedAccountBalance(tx, {
      accountId,
      userId,
      householdId,
      balanceCents: getAccountBalanceCents(account) + delta,
    });
  }
}

export function buildNextTransferFields({
  transferOut,
  transferIn,
  date,
  description,
  notes,
  isPending,
}: {
  transferOut: { date: string; description: string | null; notes: string | null; isPending: boolean | null };
  transferIn: { description: string | null; notes: string | null; isPending: boolean | null };
  date?: string;
  description?: string;
  notes?: string | null;
  isPending?: boolean;
}) {
  return {
    nextDate: date ?? transferOut.date,
    nextDescription: description ?? transferOut.description ?? transferIn.description ?? 'Transfer',
    nextNotes: notes !== undefined ? notes : transferOut.notes ?? transferIn.notes ?? null,
    nextIsPending:
      isPending !== undefined ? isPending : transferOut.isPending || transferIn.isPending || false,
  };
}
