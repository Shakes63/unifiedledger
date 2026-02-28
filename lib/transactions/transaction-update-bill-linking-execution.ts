import { processUpdatedBillPayment } from '@/lib/transactions/transaction-update-bill-linking-helpers';
import type { UpdatedBillLinkMatch } from '@/lib/transactions/transaction-update-bill-linking-matches';

export async function executeUpdatedBillLinkMatch({
  match,
  transactionId,
  userId,
  householdId,
  newAccountId,
  newAmount,
  newDate,
}: {
  match: UpdatedBillLinkMatch;
  transactionId: string;
  userId: string;
  householdId: string;
  newAccountId: string;
  newAmount: number;
  newDate: string;
}): Promise<void> {
  await processUpdatedBillPayment({
    templateId: match.templateId,
    occurrenceId: match.occurrenceId,
    transactionId,
    paymentAmount: newAmount,
    paymentDate: newDate,
    userId,
    householdId,
    linkedAccountId: newAccountId,
    notes: match.notes,
  });
}
