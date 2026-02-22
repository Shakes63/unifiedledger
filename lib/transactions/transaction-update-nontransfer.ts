import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { resolveAccountEntityId } from '@/lib/household/entities';
import { buildAccountBalanceFields, getAccountBalanceCents } from '@/lib/transactions/money-movement-service';

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
  const oldAccount = await tx
    .select()
    .from(accounts)
    .where(eq(accounts.id, transaction.accountId))
    .limit(1);

  const newAccount = await tx
    .select()
    .from(accounts)
    .where(eq(accounts.id, newAccountId))
    .limit(1);

  if (oldAccount.length === 0 || newAccount.length === 0) {
    return;
  }

  let oldBalanceCents = getAccountBalanceCents(oldAccount[0]);
  if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
    oldBalanceCents += oldAmountCents;
  } else {
    oldBalanceCents -= oldAmountCents;
  }

  await tx
    .update(accounts)
    .set(buildAccountBalanceFields(oldBalanceCents))
    .where(eq(accounts.id, transaction.accountId));

  let newBalanceCents = getAccountBalanceCents(newAccount[0]);
  if (transaction.type === 'expense' || transaction.type === 'transfer_out') {
    newBalanceCents -= newAmountCents;
  } else {
    newBalanceCents += newAmountCents;
  }

  await tx
    .update(accounts)
    .set(buildAccountBalanceFields(newBalanceCents))
    .where(eq(accounts.id, newAccountId));
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
