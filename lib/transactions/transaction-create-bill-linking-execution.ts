import { processLinkedBillPaymentWithLog } from '@/lib/transactions/transaction-bill-linking-helpers';
import type { CreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-types';

export async function executeCreateBillLinkMatch({
  match,
  transactionId,
  userId,
  householdId,
  accountId,
  amount,
  date,
}: {
  match: CreateBillLinkMatch;
  transactionId: string;
  userId: string;
  householdId: string;
  accountId: string;
  amount: number;
  date: string;
}): Promise<{ linkedBillId: string; linkedInstanceId: string }> {
  await processLinkedBillPaymentWithLog({
    transactionId,
    userId,
    householdId,
    accountId,
    amount,
    date,
    linkedTemplateId: match.linkedTemplateId,
    linkedOccurrenceId: match.linkedOccurrenceId,
    templateName: match.templateName,
    notes: match.notes,
    logScope: 'transactions:create',
    logMessage: match.logMessage,
  });

  return {
    linkedBillId: match.linkedTemplateId,
    linkedInstanceId: match.linkedOccurrenceId,
  };
}
