import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { resolveAccountEntityId } from '@/lib/household/entities';
import { applyAccountBalanceDeltas } from '@/lib/transactions/money-movement-service';

type DbClient = typeof db;

export function shouldAdjustAccountBalances(
  amount: unknown,
  newAccountId: string,
  currentAccountId: string
): boolean {
  return amount !== undefined || newAccountId !== currentAccountId;
}

export async function adjustUpdatedTransactionAccountBalances(
  tx: DbClient,
  {
    transaction,
    newAccountId,
    oldAmountCents,
    newAmountCents,
  }: {
    transaction: typeof transactions.$inferSelect;
    newAccountId: string;
    oldAmountCents: number;
    newAmountCents: number;
  }
) {
  // A debit (expense / transfer_out) originally decreased the source balance, so
  // reversing it ADDS the old amount back; the re-applied new amount SUBTRACTS.
  // Income / transfer_in is the mirror image.
  const isDebit =
    transaction.type === 'expense' || transaction.type === 'transfer_out';

  const reversalDelta = isDebit ? oldAmountCents : -oldAmountCents;
  const applyDelta = isDebit ? -newAmountCents : newAmountCents;

  // Coalesce per account. When the account is unchanged (same-account amount
  // edit) both deltas target one account and net to (old - new); applying them
  // as two separate absolute writes from the same stale read previously dropped
  // the reversal entirely, corrupting the balance by the old amount (C-TXN-1).
  await applyAccountBalanceDeltas(tx, [
    { accountId: transaction.accountId, deltaCents: reversalDelta },
    { accountId: newAccountId, deltaCents: applyDelta },
  ]);
}

export async function resolveUpdatedTransactionEntityId(
  tx: DbClient,
  {
    householdId,
    userId,
    newAccountId,
    transaction,
  }: {
    householdId: string;
    userId: string;
    newAccountId: string;
    transaction: typeof transactions.$inferSelect;
  }
) {
  if (newAccountId === transaction.accountId) {
    return resolveAccountEntityId(householdId, userId, transaction.entityId);
  }

  const accountRow = await tx
    .select({ entityId: accounts.entityId })
    .from(accounts)
    .where(eq(accounts.id, newAccountId))
    .limit(1);

  return resolveAccountEntityId(householdId, userId, accountRow[0]?.entityId);
}
