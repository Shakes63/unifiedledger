import { and, eq, inArray } from 'drizzle-orm';

import { findMatchingBillInstance } from '@/lib/bills/bill-matching-helpers';
import { db } from '@/lib/db';
import { billInstances, bills, transactions } from '@/lib/db/schema';
import { findCategoryFallbackBillMatch } from '@/lib/transactions/transaction-update-bill-linking-helpers';

export interface UpdatedBillLinkMatch {
  billId: string;
  billName: string;
  instanceId: string;
  legacyDebtId: string | null;
  notes: string;
}

export async function matchUpdatedTransactionByExplicitBillInstance({
  billInstanceId,
  userId,
  householdId,
}: {
  billInstanceId?: string;
  userId: string;
  householdId: string;
}): Promise<UpdatedBillLinkMatch | null> {
  if (!billInstanceId) {
    return null;
  }

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

  if (!instance) {
    return null;
  }

  return {
    billId: instance.bill.id,
    billName: instance.bill.name,
    instanceId: instance.instance.id,
    legacyDebtId: instance.bill.debtId,
    notes: `Bill payment update: ${instance.bill.name}`,
  };
}

export async function matchUpdatedTransactionByGeneralHeuristics({
  transactionId,
  userId,
  householdId,
  transactionType,
  newDescription,
  newAmount,
  newDate,
  newCategoryId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  transactionType: typeof transactions.$inferSelect['type'];
  newDescription: string;
  newAmount: number;
  newDate: string;
  newCategoryId: string | null;
}): Promise<UpdatedBillLinkMatch | null> {
  if (!transactionType) {
    return null;
  }

  const billMatch = await findMatchingBillInstance(
    {
      id: transactionId,
      description: newDescription,
      amount: newAmount,
      date: newDate,
      type: transactionType,
      categoryId: newCategoryId,
    },
    userId,
    householdId,
    70
  );

  if (!billMatch) {
    return null;
  }

  const [bill] = await db.select().from(bills).where(eq(bills.id, billMatch.billId)).limit(1);
  if (!bill) {
    return null;
  }

  return {
    billId: bill.id,
    billName: bill.name,
    instanceId: billMatch.instanceId,
    legacyDebtId: bill.debtId,
    notes: `Auto-matched bill update: ${bill.name}`,
  };
}

export async function matchUpdatedTransactionByCategoryFallback({
  userId,
  householdId,
  categoryId,
}: {
  userId: string;
  householdId: string;
  categoryId: string;
}): Promise<UpdatedBillLinkMatch | null> {
  const match = await findCategoryFallbackBillMatch({
    userId,
    householdId,
    categoryId,
  });
  if (!match) {
    return null;
  }

  return {
    billId: match.bill.id,
    billName: match.bill.name,
    instanceId: match.instance.id,
    legacyDebtId: match.bill.debtId,
    notes: `Category-matched bill update: ${match.bill.name}`,
  };
}
