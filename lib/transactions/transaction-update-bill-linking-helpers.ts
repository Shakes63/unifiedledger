import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { billInstances, transactions } from '@/lib/db/schema';
import { processAndLinkBillPayment } from '@/lib/transactions/payment-linkage';

export function shouldRematchUpdatedExpenseBill({
  amountWasProvided,
  newAmount,
  newDate,
  newDescription,
  newCategoryId,
  transaction,
}: {
  amountWasProvided: boolean;
  newAmount: number;
  newDate: string;
  newDescription: string;
  newCategoryId: string | null;
  transaction: typeof transactions.$inferSelect;
}): boolean {
  const categoryChanged = newCategoryId !== transaction.categoryId;
  const descriptionChanged = newDescription !== transaction.description;
  const amountChanged = amountWasProvided && newAmount !== transaction.amount;
  const dateChanged = newDate !== transaction.date;
  return categoryChanged || descriptionChanged || amountChanged || dateChanged;
}

export async function unlinkExistingBillInstance({
  transactionId,
  userId,
  householdId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
}): Promise<void> {
  const oldInstance = await db
    .select()
    .from(billInstances)
    .where(
      and(
        eq(billInstances.transactionId, transactionId),
        eq(billInstances.userId, userId),
        eq(billInstances.householdId, householdId)
      )
    )
    .limit(1);

  if (oldInstance.length === 0) {
    return;
  }

  await db
    .update(billInstances)
    .set({
      status: 'pending',
      paidDate: null,
      actualAmount: null,
      transactionId: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(billInstances.id, oldInstance[0].id));
}

export async function processUpdatedBillPayment({
  billId,
  billName,
  instanceId,
  transactionId,
  paymentAmount,
  paymentDate,
  userId,
  householdId,
  linkedAccountId,
  notes,
  legacyDebtId,
}: {
  billId: string;
  billName: string;
  instanceId: string;
  transactionId: string;
  paymentAmount: number;
  paymentDate: string;
  userId: string;
  householdId: string;
  linkedAccountId: string;
  notes: string;
  legacyDebtId: string | null;
}) {
  return processAndLinkBillPayment({
    billId,
    billName,
    instanceId,
    transactionId,
    paymentAmount,
    paymentDate,
    userId,
    householdId,
    paymentMethod: 'manual',
    linkedAccountId,
    notes,
    legacyDebtId,
  });
}
