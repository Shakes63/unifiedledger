/**
 * Payment Bill Detection
 * 
 * Detects linked payment bills when a user is creating a transfer
 * to a credit card account. Provides UI feedback before save.
 */

import { db } from '@/lib/db';
import { bills, billInstances, accounts } from '@/lib/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { differenceInDays, parseISO } from 'date-fns';

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

/**
 * Credit account types
 */
const CREDIT_ACCOUNT_TYPES = ['credit', 'line_of_credit'] as const;

/**
 * Detect payment bills linked to a destination credit account.
 * Used to show auto-detection banner when creating transfers.
 * 
 * @param destinationAccountId - The ID of the account being transferred to
 * @param householdId - The household ID for scoping
 * @param dateToleranceDays - Days before/after due date to consider (default: 14)
 * @returns Detection result with suggested bill and confidence level
 */
export async function detectPaymentBill(
  destinationAccountId: string,
  householdId: string,
  dateToleranceDays: number = 14
): Promise<PaymentBillDetectionResult> {
  // Get the destination account to check its type
  const [destinationAccount] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, destinationAccountId),
        eq(accounts.householdId, householdId)
      )
    );

  if (!destinationAccount) {
    return {
      suggestedBillId: null,
      suggestedInstanceId: null,
      detectedBill: null,
      confidence: 'none',
      reason: 'Destination account not found',
      isCreditAccount: false,
    };
  }

  // Check if this is a credit-type account
  const isCreditAccount = (CREDIT_ACCOUNT_TYPES as readonly string[]).includes(destinationAccount.type);

  if (!isCreditAccount) {
    return {
      suggestedBillId: null,
      suggestedInstanceId: null,
      detectedBill: null,
      confidence: 'none',
      reason: '',
      isCreditAccount: false,
    };
  }

  // Find bills linked to this credit account
  const linkedBills = await db
    .select({
      id: bills.id,
      name: bills.name,
      expectedAmount: bills.expectedAmount,
      linkedAccountId: bills.linkedAccountId,
    })
    .from(bills)
    .where(
      and(
        eq(bills.linkedAccountId, destinationAccountId),
        eq(bills.householdId, householdId),
        eq(bills.isActive, true)
      )
    );

  if (!linkedBills.length) {
    return {
      suggestedBillId: null,
      suggestedInstanceId: null,
      detectedBill: null,
      confidence: 'low',
      reason: `No payment bill is linked to "${destinationAccount.name}". Transfers will still reduce the balance.`,
      isCreditAccount: true,
    };
  }

  // Get pending/overdue instances for these bills
  const billIds = linkedBills.map(b => b.id);
  const pendingInstances = await db
    .select({
      id: billInstances.id,
      billId: billInstances.billId,
      dueDate: billInstances.dueDate,
      expectedAmount: billInstances.expectedAmount,
      paidAmount: billInstances.paidAmount,
      remainingAmount: billInstances.remainingAmount,
      status: billInstances.status,
      paymentStatus: billInstances.paymentStatus,
    })
    .from(billInstances)
    .where(
      and(
        inArray(billInstances.billId, billIds),
        eq(billInstances.householdId, householdId),
        or(
          eq(billInstances.status, 'pending'),
          eq(billInstances.status, 'overdue'),
          eq(billInstances.paymentStatus, 'partial')
        )
      )
    );

  if (!pendingInstances.length) {
    // Bills exist but no pending instances
    return {
      suggestedBillId: null,
      suggestedInstanceId: null,
      detectedBill: null,
      confidence: 'medium',
      reason: `Payment bill "${linkedBills[0].name}" exists but has no unpaid instances.`,
      isCreditAccount: true,
    };
  }

  // Find best matching instance based on date proximity
  const today = new Date();
  let bestMatch: {
    instance: typeof pendingInstances[0];
    bill: typeof linkedBills[0];
    dateDiff: number;
    priority: number; // Higher = better match
  } | null = null;

  for (const instance of pendingInstances) {
    const bill = linkedBills.find(b => b.id === instance.billId);
    if (!bill) continue;

    const dueDate = parseISO(instance.dueDate);
    const dateDiff = differenceInDays(dueDate, today);
    const absDateDiff = Math.abs(dateDiff);

    // Skip if outside tolerance
    if (absDateDiff > dateToleranceDays) continue;

    // Calculate priority score (higher = better)
    let priority = 100 - absDateDiff; // Base score from date proximity
    
    // Boost overdue instances
    if (instance.status === 'overdue') {
      priority += 50;
    }
    
    // Boost partial payments that need completion
    if (instance.paymentStatus === 'partial') {
      priority += 25;
    }

    // Prefer instances due soon (within 7 days)
    if (dateDiff >= 0 && dateDiff <= 7) {
      priority += 30;
    }

    if (!bestMatch || priority > bestMatch.priority) {
      bestMatch = { instance, bill, dateDiff, priority };
    }
  }

  if (!bestMatch) {
    // Instances exist but none within tolerance
    return {
      suggestedBillId: linkedBills[0].id,
      suggestedInstanceId: null,
      detectedBill: null,
      confidence: 'low',
      reason: `Payment bill "${linkedBills[0].name}" has upcoming instances but none due within ${dateToleranceDays} days.`,
      isCreditAccount: true,
    };
  }

  // Build the detected bill result
  const { instance, bill, dateDiff } = bestMatch;
  const isOverdue = instance.status === 'overdue';
  const isPartial = instance.paymentStatus === 'partial';
  
  // Determine instance status for UI
  let instanceStatus: 'pending' | 'overdue' | 'partial';
  if (isOverdue) {
    instanceStatus = 'overdue';
  } else if (isPartial) {
    instanceStatus = 'partial';
  } else {
    instanceStatus = 'pending';
  }

  const detectedBill: DetectedPaymentBill = {
    billId: bill.id,
    instanceId: instance.id,
    billName: bill.name,
    expectedAmount: instance.expectedAmount,
    dueDate: instance.dueDate,
    status: instanceStatus,
    paidAmount: instance.paidAmount || 0,
    remainingAmount: instance.remainingAmount || instance.expectedAmount,
    linkedAccountName: destinationAccount.name,
  };

  // Determine confidence and reason
  let confidence: 'high' | 'medium' | 'low';
  let reason: string;

  if (isOverdue) {
    confidence = 'high';
    reason = `This transfer will pay your overdue "${bill.name}" bill (${Math.abs(dateDiff)} days past due)`;
  } else if (isPartial) {
    const remaining = instance.remainingAmount || (instance.expectedAmount - (instance.paidAmount || 0));
    confidence = 'high';
    reason = `This will complete your partial payment for "${bill.name}" ($${remaining.toFixed(2)} remaining)`;
  } else if (dateDiff <= 7 && dateDiff >= 0) {
    confidence = 'high';
    reason = `This transfer will pay your "${bill.name}" bill due ${dateDiff === 0 ? 'today' : `in ${dateDiff} day${dateDiff === 1 ? '' : 's'}`}`;
  } else if (dateDiff > 7 && dateDiff <= 14) {
    confidence = 'medium';
    reason = `This transfer can pay your "${bill.name}" bill due in ${dateDiff} days`;
  } else {
    // Due date in the past but not marked overdue (shouldn't happen often)
    confidence = 'medium';
    reason = `This transfer matches your "${bill.name}" payment bill`;
  }

  return {
    suggestedBillId: bill.id,
    suggestedInstanceId: instance.id,
    detectedBill,
    confidence,
    reason,
    isCreditAccount: true,
  };
}

/**
 * Check if an account is a credit-type account
 * @param accountId - The account ID to check
 * @param householdId - The household ID for scoping
 * @returns Boolean indicating if account is credit type
 */
export async function isCreditTypeAccount(
  accountId: string,
  householdId: string
): Promise<boolean> {
  const [account] = await db
    .select({ type: accounts.type })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);

  if (!account) return false;
  return (CREDIT_ACCOUNT_TYPES as readonly string[]).includes(account.type);
}
