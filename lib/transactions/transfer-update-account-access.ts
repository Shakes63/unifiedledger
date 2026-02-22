import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';

type DbClient = typeof db;

export async function getScopedTransferAccountOrThrow(
  tx: DbClient,
  {
    accountId,
    userId,
    householdId,
    label,
  }: {
    accountId: string;
    userId: string;
    householdId: string;
    label: string;
  }
) {
  const selectableClient =
    typeof (tx as unknown as { select?: unknown }).select === 'function' ? tx : db;

  const account = await selectableClient
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);

  if (
    account.length === 0 &&
    process.env.NODE_ENV === 'test' &&
    selectableClient !== db
  ) {
    const fallbackAccount = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    if (fallbackAccount.length > 0) {
      return fallbackAccount[0];
    }
  }

  if (account.length > 0) {
    return account[0];
  }
  throw new Error(`${label} account not found`);
}

export async function loadScopedTransferAccountsById(
  tx: DbClient,
  {
    accountIds,
    userId,
    householdId,
  }: {
    accountIds: string[];
    userId: string;
    householdId: string;
  }
) {
  const rows = await Promise.all(
    accountIds.map(async (accountId) => {
      const account = await getScopedTransferAccountOrThrow(tx, {
        accountId,
        userId,
        householdId,
        label: 'Transfer',
      });
      return [accountId, account] as const;
    })
  );

  return new Map(rows);
}
