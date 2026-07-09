/**
 * Payment linkage for created transactions: routes a debt/bill-linked create to the right payment recorder.
 *
 * Consolidated from single-use shim files during the post-audit cleanup;
 * behavior is unchanged.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { processBillPayment } from '@/lib/bills/bill-payment-utils';
import {
  loadScopedDebt,
  persistLegacyDebtPayment,
  type PaymentLinkageDbClient,
} from '@/lib/transactions/payment-linkage-debt';

// ---------------------------------------------------------------------------
// from payment-linkage-bill.ts
// ---------------------------------------------------------------------------
async function processAndAttachBillPayment({
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

// ---------------------------------------------------------------------------
// from payment-linkage.ts
// ---------------------------------------------------------------------------
type DbClient = PaymentLinkageDbClient;

interface ApplyLegacyDebtPaymentParams {
  debtId: string;
  userId: string;
  householdId: string;
  paymentAmount: number;
  paymentDate: string;
  transactionId: string;
  notes: string;
  dbClient?: DbClient;
}

export async function applyLegacyDebtPayment({
  debtId,
  userId,
  householdId,
  paymentAmount,
  paymentDate,
  transactionId,
  notes,
  dbClient = db,
}: ApplyLegacyDebtPaymentParams): Promise<boolean> {
  const currentDebt = await loadScopedDebt({
    dbClient,
    debtId,
    userId,
    householdId,
  });

  if (!currentDebt) {
    return false;
  }

  await persistLegacyDebtPayment({
    dbClient,
    debtId,
    userId,
    householdId,
    paymentAmount,
    paymentDate,
    transactionId,
    notes,
    currentDebt,
  });

  return true;
}

interface ProcessAndLinkTemplatePaymentParams {
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
}

export async function processAndLinkTemplatePayment({
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
}: ProcessAndLinkTemplatePaymentParams) {
  const billLinkResult = await processAndAttachBillPayment({
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
  });
  if (!billLinkResult.success) {
    return billLinkResult;
  }

  return {
    success: true,
    paymentResult: billLinkResult.paymentResult,
  };
}
