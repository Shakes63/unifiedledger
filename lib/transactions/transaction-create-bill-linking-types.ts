export interface CreateBillLinkMatch {
  linkedTemplateId: string;
  linkedOccurrenceId: string;
  templateName: string;
  notes: string;
  logMessage: (paymentStatus: string) => string;
}
