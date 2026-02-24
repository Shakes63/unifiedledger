/**
 * Shared UI shape for payment bill detection responses.
 *
 * Detection is provided by `GET /api/bills-v2/detect-payment`.
 * This module intentionally exports type contracts only.
 */

/**
 * Detected payment bill with instance details
 */
export interface DetectedPaymentBill {
  billId: string;
  instanceId: string;
  billName: string;
  expectedAmount: number;
  dueDate: string;
  status: 'pending' | 'overdue' | 'partial';
  paidAmount: number;
  remainingAmount: number;
  linkedAccountName: string;
}

/**
 * Result of payment bill detection
 */
export interface PaymentBillDetectionResult {
  /** The detected bill ID (if found) */
  suggestedBillId: string | null;
  /** The detected instance ID (if found) */
  suggestedInstanceId: string | null;
  /** Full details of the detected bill */
  detectedBill: DetectedPaymentBill | null;
  /** Confidence level of the detection */
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Human-readable reason for the detection */
  reason: string;
  /** Whether the destination account is a credit-type account */
  isCreditAccount: boolean;
}
