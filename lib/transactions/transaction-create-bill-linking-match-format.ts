import type { CreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-types';

export function formatCreateBillLinkMatch({
  billId,
  instanceId,
  billName,
  legacyDebtId,
  notes,
  logMessage,
}: {
  billId: string;
  instanceId: string;
  billName: string;
  legacyDebtId: string | null;
  notes: string;
  logMessage: (paymentStatus: string) => string;
}): CreateBillLinkMatch {
  return {
    linkedBillId: billId,
    linkedInstanceId: instanceId,
    billName,
    legacyDebtId,
    notes,
    logMessage,
  };
}
