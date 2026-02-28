import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { processBillPayment } from '@/lib/bills/bill-payment-utils';

export async function processAndAttachBillPayment({
  templateId,
  occurrenceId,
  transactionId,
  paymentAmount,
  paymentDate,
  userId,
  householdId,
  linkedAccountId,
  paymentMethod,
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
  paymentMethod: 'manual' | 'transfer' | 'autopay';
  notes: string;
}) {
  const paymentResult = await processBillPayment({
    billId: templateId,
    instanceId: occurrenceId,
    transactionId,
    paymentAmount,
    paymentDate,
    userId,
    householdId,
    paymentMethod,
    linkedAccountId,
    notes,
  });

  if (!paymentResult.success) {
    return {
      success: false as const,
      paymentResult,
    };
  }

  await db
    .update(transactions)
    .set({
      billId: templateId,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      )
    );

  return {
    success: true as const,
    paymentResult,
  };
}
