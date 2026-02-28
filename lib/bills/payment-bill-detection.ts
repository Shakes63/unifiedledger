/**
 * Shared UI shape for template payment detection responses.
 *
 * Detection is provided by `GET /api/bills/detect-payment`.
 * This module intentionally exports type contracts only.
 */

/**
 * Detected payment template with occurrence details
 */
export interface DetectedPaymentBill {
  templateId: string;
  occurrenceId: string;
  templateName: string;
  expectedAmountCents: number;
  dueDate: string;
  status: 'unpaid' | 'overdue' | 'partial';
  paidAmountCents: number;
  remainingAmountCents: number;
  linkedAccountName: string;
}

/**
 * Result of template payment detection
 */
export interface PaymentBillDetectionResult {
  /** Full details of the detected template */
  detectedBill: DetectedPaymentBill | null;
  /** Confidence level of the detection */
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Human-readable reason for the detection */
  reason: string;
  /** Whether the destination account is a credit-type account */
  isCreditAccount: boolean;
}
