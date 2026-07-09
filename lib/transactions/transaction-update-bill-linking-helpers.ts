import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { billOccurrences, transactions } from '@/lib/db/schema';
import { processAndLinkTemplatePayment } from '@/lib/transactions/payment-linkage';
import { reverseBillPayments } from '@/lib/transactions/transaction-side-effect-reversal';

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
  householdId,
}: {
  transactionId: string;
  householdId: string;
}): Promise<void> {
  // Fully unwind the payments this transaction made — restores amountPaidCents/
  // amountRemainingCents, recomputes status, and deletes the payment events
  // (audit finding H-BILL-2: the previous reset cleared status/paidDate but left
  // amountPaidCents, so re-linking stacked the new payment on top and produced
  // 'overpaid' occurrences with only one real payment; it also found the
  // occurrence only via lastTransactionId, missing links a later payment
  // overwrote).
  await reverseBillPayments(db, { transactionId, householdId });

  // Fallback for legacy links with no payment event: reset any occurrence that
  // still points at this transaction.
  const oldInstance = await db
    .select()
    .from(billOccurrences)
    .where(
      and(
        eq(billOccurrences.lastTransactionId, transactionId),
        eq(billOccurrences.householdId, householdId)
      )
    )
    .limit(1);

  if (oldInstance.length === 0) {
    return;
  }

  await db
    .update(billOccurrences)
    .set({
      status: 'unpaid',
      paidDate: null,
      actualAmountCents: null,
      amountPaidCents: 0,
      amountRemainingCents: oldInstance[0].amountDueCents,
      lastTransactionId: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(billOccurrences.id, oldInstance[0].id));
}

export async function processUpdatedBillPayment({
  templateId,
  occurrenceId,
  transactionId,
  paymentAmount,
  paymentDate,
  userId,
  householdId,
  linkedAccountId,
  notes,
}: {
  templateId: string;
  occurrenceId: string;
  transactionId: string;
  paymentAmount: number;
  paymentDate: string;
  userId: string;
  householdId: string;
  linkedAccountId: string;
  notes: string;
}) {
  return processAndLinkTemplatePayment({
    templateId,
    occurrenceId,
    transactionId,
    paymentAmount,
    paymentDate,
    userId,
    householdId,
    paymentMethod: 'manual',
    linkedAccountId,
    notes,
  });
}
