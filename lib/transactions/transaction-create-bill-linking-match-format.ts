import type { CreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-types';

export function formatCreateBillLinkMatch({
  templateId,
  occurrenceId,
  templateName,
  notes,
  logMessage,
}: {
  templateId: string;
  occurrenceId: string;
  templateName: string;
  notes: string;
  logMessage: (paymentStatus: string) => string;
}): CreateBillLinkMatch {
  return {
    linkedTemplateId: templateId,
    linkedOccurrenceId: occurrenceId,
    templateName,
    notes,
    logMessage,
  };
}
