import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { billInstances, bills } from '@/lib/db/schema';

export async function findScopedBillById({
  billId,
  userId,
  householdId,
}: {
  billId: string;
  userId: string;
  householdId: string;
}): Promise<typeof bills.$inferSelect | null> {
  const [bill] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.userId, userId), eq(bills.householdId, householdId)))
    .limit(1);
  return bill ?? null;
}

export async function findScopedPendingBillInstanceById({
  billInstanceId,
  userId,
  householdId,
}: {
  billInstanceId: string;
  userId: string;
  householdId: string;
}): Promise<
  | {
      instance: typeof billInstances.$inferSelect;
      bill: typeof bills.$inferSelect;
    }
  | null
> {
  const [instance] = await db
    .select({
      instance: billInstances,
      bill: bills,
    })
    .from(billInstances)
    .innerJoin(bills, eq(bills.id, billInstances.billId))
    .where(
      and(
        eq(billInstances.id, billInstanceId),
        eq(billInstances.userId, userId),
        eq(billInstances.householdId, householdId),
        inArray(billInstances.status, ['pending', 'overdue'])
      )
    )
    .limit(1);

  return instance ?? null;
}

export async function listChargedAccountPendingBills({
  userId,
  householdId,
  accountId,
}: {
  userId: string;
  householdId: string;
  accountId: string;
}): Promise<
  Array<{
    bill: typeof bills.$inferSelect;
    instance: typeof billInstances.$inferSelect;
  }>
> {
  return db
    .select({
      bill: bills,
      instance: billInstances,
    })
    .from(bills)
    .innerJoin(billInstances, eq(billInstances.billId, bills.id))
    .where(
      and(
        eq(bills.chargedToAccountId, accountId),
        eq(bills.userId, userId),
        eq(bills.householdId, householdId),
        eq(bills.isActive, true),
        eq(billInstances.userId, userId),
        eq(billInstances.householdId, householdId),
        inArray(billInstances.status, ['pending', 'overdue'])
      )
    )
    .orderBy(
      sql`CASE WHEN ${billInstances.status} = 'overdue' THEN 0 ELSE 1 END`,
      asc(billInstances.dueDate)
    );
}

export async function findCategoryPendingBillMatch({
  userId,
  householdId,
  categoryId,
}: {
  userId: string;
  householdId: string;
  categoryId: string;
}): Promise<
  | {
      bill: typeof bills.$inferSelect;
      instance: typeof billInstances.$inferSelect;
    }
  | null
> {
  const [match] = await db
    .select({
      bill: bills,
      instance: billInstances,
    })
    .from(bills)
    .innerJoin(billInstances, eq(billInstances.billId, bills.id))
    .where(
      and(
        eq(bills.userId, userId),
        eq(bills.householdId, householdId),
        eq(bills.isActive, true),
        eq(bills.categoryId, categoryId),
        eq(billInstances.userId, userId),
        eq(billInstances.householdId, householdId),
        inArray(billInstances.status, ['pending', 'overdue'])
      )
    )
    .orderBy(
      sql`CASE WHEN ${billInstances.status} = 'overdue' THEN 0 ELSE 1 END`,
      asc(billInstances.dueDate)
    )
    .limit(1);

  return match ?? null;
}
