import { and, eq, isNull, or } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, transfers } from '@/lib/db/schema';

export async function getTransferForSelectedEntity({
  transferId,
  userId,
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
}: {
  transferId: string;
  userId: string;
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
}) {
  const transferRows = await db
    .select()
    .from(transfers)
    .where(
      and(
        eq(transfers.id, transferId),
        eq(transfers.userId, userId),
        eq(transfers.householdId, householdId)
      )
    )
    .limit(1);
  const transfer = transferRows[0];
  if (!transfer) {
    return null;
  }

  const visibleAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId),
        selectedEntityIsDefault
          ? or(eq(accounts.entityId, selectedEntityId), isNull(accounts.entityId))
          : eq(accounts.entityId, selectedEntityId),
        or(eq(accounts.id, transfer.fromAccountId), eq(accounts.id, transfer.toAccountId))
      )
    );

  if (visibleAccounts.length === 0) {
    return null;
  }

  return transfer;
}

export async function getTransferAccountNames({
  userId,
  householdId,
  fromAccountId,
  toAccountId,
}: {
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
}) {
  const [fromAccount, toAccount] = await Promise.all([
    db
      .select({ name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, fromAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1),
    db
      .select({ name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, toAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1),
  ]);

  if (fromAccount.length === 0 || toAccount.length === 0) {
    return null;
  }

  return {
    fromAccountName: fromAccount[0].name,
    toAccountName: toAccount[0].name,
  };
}
