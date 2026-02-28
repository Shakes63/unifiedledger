import { db } from '@/lib/db';
import { processAndAttachBillPayment } from '@/lib/transactions/payment-linkage-bill';
import {
  loadScopedDebt,
  persistLegacyDebtPayment,
  type PaymentLinkageDbClient,
} from '@/lib/transactions/payment-linkage-debt';

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
