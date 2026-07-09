import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { resolveAccountEntityId } from '@/lib/household/entities';
import {
  applyAccountBalanceDeltas,
  computeBalanceDeltaCents,
  type MovementTransactionType,
} from '@/lib/transactions/money-movement-service';

type DbClient = typeof db;

async function getAccountType(
  tx: DbClient,
  accountId: string
): Promise<string | null | undefined> {
  const [row] = await tx
    .select({ type: accounts.type })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  return row?.type;
}

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
  const oldAccountId = transaction.accountId;
  const type = transaction.type as MovementTransactionType;

  // Fetch the account types so reversal/apply are liability-aware (C-MATH-1):
  // the reversal must undo the original effect on the OLD account, and the
  // re-apply uses the NEW account's type.
  const oldAccountType = await getAccountType(tx, oldAccountId);
  const newAccountType =
    newAccountId === oldAccountId ? oldAccountType : await getAccountType(tx, newAccountId);

  // Reversal on the old account = negate the original applied delta.
  const reversalDelta = -computeBalanceDeltaCents({
    accountType: oldAccountType,
    transactionType: type,
    amountCents: oldAmountCents,
  });
  // Re-apply on the new account with the new amount.
  const applyDelta = computeBalanceDeltaCents({
    accountType: newAccountType,
    transactionType: type,
    amountCents: newAmountCents,
  });

  // Coalesce per account. When the account is unchanged (same-account amount
  // edit) both deltas target one account and net to the correct change; applying
  // them as two separate absolute writes from the same stale read previously
  // dropped the reversal entirely, corrupting the balance (C-TXN-1).
  await applyAccountBalanceDeltas(tx, [
    { accountId: oldAccountId, deltaCents: reversalDelta },
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
