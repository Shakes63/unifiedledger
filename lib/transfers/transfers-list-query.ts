import { and, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, transfers } from '@/lib/db/schema';

export function parseTransferListParams(request: Request): {
  limit: number;
  offset: number;
  fromDate: string | null;
  toDate: string | null;
} {
  const { searchParams } = new URL(request.url);
  return {
    limit: parseInt(searchParams.get('limit') || '50'),
    offset: parseInt(searchParams.get('offset') || '0'),
    fromDate: searchParams.get('fromDate'),
    toDate: searchParams.get('toDate'),
  };
}

export async function listEntityScopedTransfers({
  userId,
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
  limit,
  offset,
  fromDate,
  toDate,
}: {
  userId: string;
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
  limit: number;
  offset: number;
  fromDate: string | null;
  toDate: string | null;
}): Promise<Array<typeof transfers.$inferSelect>> {
  const filters = [eq(transfers.userId, userId), eq(transfers.householdId, householdId)];
  if (fromDate) {
    filters.push(gte(transfers.date, fromDate));
  }
  if (toDate) {
    filters.push(lte(transfers.date, toDate));
  }

  const transferList = await db
    .select()
    .from(transfers)
    .where(and(...filters))
    .orderBy(desc(transfers.date))
    .limit(limit)
    .offset(offset);

  const scopedAccountRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId),
        selectedEntityIsDefault
          ? or(eq(accounts.entityId, selectedEntityId), isNull(accounts.entityId))
          : eq(accounts.entityId, selectedEntityId)
      )
    );
  const scopedAccountIds = new Set(scopedAccountRows.map((row) => row.id));

  return transferList.filter(
    (transfer) =>
      scopedAccountIds.has(transfer.fromAccountId) || scopedAccountIds.has(transfer.toAccountId)
  );
}

export async function enrichTransfersWithAccountNames({
  userId,
  householdId,
  transferList,
}: {
  userId: string;
  householdId: string;
  transferList: Array<typeof transfers.$inferSelect>;
}): Promise<
  Array<
    (typeof transfers.$inferSelect) & {
      fromAccountName: string;
      toAccountName: string;
    }
  >
> {
  const transferAccountIds = Array.from(
    new Set(transferList.flatMap((transfer) => [transfer.fromAccountId, transfer.toAccountId]))
  );
  const transferAccounts = transferAccountIds.length
    ? await db
        .select({ id: accounts.id, name: accounts.name })
        .from(accounts)
        .where(
          and(
            inArray(accounts.id, transferAccountIds),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
    : [];
  const accountNameById = new Map(transferAccounts.map((account) => [account.id, account.name]));

  return transferList.map((transfer) => ({
    ...transfer,
    fromAccountName: accountNameById.get(transfer.fromAccountId) || 'Unknown',
    toAccountName: accountNameById.get(transfer.toAccountId) || 'Unknown',
  }));
}
