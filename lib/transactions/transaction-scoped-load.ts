import { and, eq, isNull, or } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';

export function buildEntityScopedTransactionFilter({
  id,
  userId,
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
}: {
  id: string;
  userId: string;
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
}) {
  const entityScope = selectedEntityIsDefault
    ? or(eq(transactions.entityId, selectedEntityId), isNull(transactions.entityId))
    : eq(transactions.entityId, selectedEntityId);

  return and(
    eq(transactions.id, id),
    eq(transactions.userId, userId),
    eq(transactions.householdId, householdId),
    entityScope
  );
}

export async function loadScopedTransactionById({
  id,
  userId,
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
}: {
  id: string;
  userId: string;
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
}): Promise<typeof transactions.$inferSelect | null> {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      buildEntityScopedTransactionFilter({
        id,
        userId,
        householdId,
        selectedEntityId,
        selectedEntityIsDefault,
      })
    )
    .limit(1);

  return rows[0] ?? null;
}
