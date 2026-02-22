export interface CreateBillLinkMatch {
  linkedBillId: string;
  linkedInstanceId: string;
  billName: string;
  legacyDebtId: string | null;
  notes: string;
  logMessage: (paymentStatus: string) => string;
}
