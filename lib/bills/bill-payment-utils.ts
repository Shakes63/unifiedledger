/**
 * Bill Payment Utilities
 * 
 * Central utility for processing bill payments with support for:
 * - Full payments
 * - Partial payments with shortfall tracking
 * - Overpayments
 * - Debt bill payments with principal/interest breakdown
 * - Payment history recording
 */

import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { bills, billInstances, billPayments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { calculatePaymentBreakdown, PaymentBreakdown } from '@/lib/debts/payment-calculator';
import { classifyInterestPayment } from '@/lib/tax/interest-tax-utils';

export interface ProcessBillPaymentParams {
  billId: string;
  instanceId: string;
  transactionId: string;
  paymentAmount: number;
  paymentDate: string;
  userId: string;
  householdId: string;
  paymentMethod?: 'manual' | 'transfer' | 'autopay';
  linkedAccountId?: string; // The account used for payment (for transfers)
  notes?: string;
}

export interface BillPaymentResult {
  success: boolean;
  paymentId: string;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overpaid';
  paidAmount: number;
  remainingAmount: number;
  principalAmount?: number;
  interestAmount?: number;
  newDebtBalance?: number;
  // Tax deduction info (Phase 11)
  taxDeductionInfo?: {
    deductionId: string;
    deductibleAmount: number;
    limitApplied?: number;
    warningMessage?: string;
  };
  error?: string;
}

/**
 * Process a payment for a bill instance
 * 
 * This function:
 * 1. Determines payment status (partial, full, overpaid)
 * 2. Creates a bill_payments record
 * 3. Updates the bill instance with payment tracking
 * 4. For debt bills, calculates principal/interest split and updates remaining balance
 * 
 * @returns BillPaymentResult with payment details and status
 */
export async function processBillPayment({
  billId,
  instanceId,
  transactionId,
  paymentAmount,
  paymentDate,
  userId,
  householdId,
  paymentMethod = 'manual',
  linkedAccountId,
  notes,
}: ProcessBillPaymentParams): Promise<BillPaymentResult> {
  try {
    // Fetch bill and instance in parallel
    const [billResult, instanceResult] = await Promise.all([
      db.select().from(bills).where(eq(bills.id, billId)).limit(1),
      db.select().from(billInstances).where(eq(billInstances.id, instanceId)).limit(1),
    ]);

    if (!billResult.length) {
      return {
        success: false,
        paymentId: '',
        paymentStatus: 'unpaid',
        paidAmount: 0,
        remainingAmount: 0,
        error: 'Bill not found',
      };
    }

    if (!instanceResult.length) {
      return {
        success: false,
        paymentId: '',
        paymentStatus: 'unpaid',
        paidAmount: 0,
        remainingAmount: 0,
        error: 'Bill instance not found',
      };
    }

    const bill = billResult[0];
    const instance = instanceResult[0];

    // Calculate payment amounts using Decimal.js for precision
    const payment = new Decimal(paymentAmount);
    const expectedAmount = new Decimal(instance.expectedAmount);
    const previousPaidAmount = new Decimal(instance.paidAmount || 0);
    const newTotalPaid = previousPaidAmount.plus(payment);
    const remaining = expectedAmount.minus(newTotalPaid);

    // Determine payment status
    let paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overpaid';
    let instanceStatus: 'pending' | 'paid' | 'overdue' | 'skipped' = instance.status as 'pending' | 'paid' | 'overdue' | 'skipped';

    if (newTotalPaid.lessThan(expectedAmount)) {
      paymentStatus = 'partial';
      // Keep instance status as pending or overdue
    } else if (newTotalPaid.equals(expectedAmount)) {
      paymentStatus = 'paid';
      instanceStatus = 'paid';
    } else {
      paymentStatus = 'overpaid';
      instanceStatus = 'paid';
    }

    // Handle debt bills - calculate principal/interest breakdown
    let breakdown: PaymentBreakdown | null = null;
    let newDebtBalance: number | undefined;
    let balanceBeforePayment: number | undefined;
    let balanceAfterPayment: number | undefined;

    if (bill.isDebt && bill.remainingBalance !== null) {
      balanceBeforePayment = bill.remainingBalance;
      
      // Calculate payment breakdown
      breakdown = calculatePaymentBreakdown(
        paymentAmount,
        bill.remainingBalance,
        bill.billInterestRate || 0,
        (bill.interestType as 'fixed' | 'variable' | 'none') || 'none',
        'installment', // Debt bills are typically installment loans
        'monthly',
        30
      );

      // Calculate new balance
      newDebtBalance = Math.max(0, bill.remainingBalance - breakdown.principalAmount);
      balanceAfterPayment = newDebtBalance;
    }

    // Create payment record ID
    const paymentId = nanoid();
    const now = new Date().toISOString();

    // Batch all database operations
    const dbOperations: Promise<unknown>[] = [
      // Create bill_payments record
      db.insert(billPayments).values({
        id: paymentId,
        billId,
        billInstanceId: instanceId,
        transactionId,
        userId,
        householdId,
        amount: paymentAmount,
        principalAmount: breakdown?.principalAmount || null,
        interestAmount: breakdown?.interestAmount || null,
        paymentDate,
        paymentMethod,
        linkedAccountId: linkedAccountId || null,
        balanceBeforePayment: balanceBeforePayment || null,
        balanceAfterPayment: balanceAfterPayment || null,
        notes: notes || null,
        createdAt: now,
      }),

      // Update bill instance
      db.update(billInstances)
        .set({
          paidAmount: newTotalPaid.toNumber(),
          remainingAmount: remaining.greaterThan(0) ? remaining.toNumber() : 0,
          paymentStatus,
          status: instanceStatus,
          paidDate: paymentStatus === 'paid' || paymentStatus === 'overpaid' ? paymentDate : instance.paidDate,
          transactionId: transactionId, // Link to most recent transaction
          actualAmount: newTotalPaid.toNumber(),
          principalPaid: breakdown 
            ? new Decimal(instance.principalPaid || 0).plus(breakdown.principalAmount).toNumber()
            : instance.principalPaid,
          interestPaid: breakdown
            ? new Decimal(instance.interestPaid || 0).plus(breakdown.interestAmount).toNumber()
            : instance.interestPaid,
          updatedAt: now,
        })
        .where(eq(billInstances.id, instanceId)),
    ];

    // If debt bill, update the bill's remaining balance
    if (bill.isDebt && newDebtBalance !== undefined) {
      dbOperations.push(
        db.update(bills)
          .set({
            remainingBalance: newDebtBalance,
          })
          .where(eq(bills.id, billId))
      );
    }

    // Execute all operations in parallel
    await Promise.all(dbOperations);

    // Phase 11: Auto-classify interest for tax deduction if applicable
    let taxDeductionInfo: BillPaymentResult['taxDeductionInfo'];
    if (
      bill.isDebt &&
      bill.isInterestTaxDeductible &&
      bill.taxDeductionType !== 'none' &&
      breakdown?.interestAmount &&
      breakdown.interestAmount > 0
    ) {
      try {
        const taxResult = await classifyInterestPayment(
          userId,
          householdId,
          billId,
          paymentId,
          breakdown.interestAmount,
          paymentDate
        );

        if (taxResult.success && taxResult.deductionId) {
          taxDeductionInfo = {
            deductionId: taxResult.deductionId,
            deductibleAmount: taxResult.deductibleAmount,
            limitApplied: taxResult.limitApplied,
            warningMessage: taxResult.warningMessage,
          };
        }
      } catch (taxError) {
        // Log but don't fail the payment if tax classification fails
        console.warn('Failed to classify interest for tax:', taxError);
      }
    }

    return {
      success: true,
      paymentId,
      paymentStatus,
      paidAmount: newTotalPaid.toNumber(),
      remainingAmount: remaining.greaterThan(0) ? remaining.toNumber() : 0,
      principalAmount: breakdown?.principalAmount,
      interestAmount: breakdown?.interestAmount,
      newDebtBalance,
      taxDeductionInfo,
    };
  } catch (error) {
    console.error('Error processing bill payment:', error);
    return {
      success: false,
      paymentId: '',
      paymentStatus: 'unpaid',
      paidAmount: 0,
      remainingAmount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Find a pending bill instance for a credit account payment
 * 
 * When a transfer is made to a credit card, this function finds
 * the appropriate bill instance to mark as paid.
 * 
 * @param linkedAccountId - The credit account being paid
 * @param paymentAmount - The payment amount
 * @param paymentDate - The payment date
 * @param dateToleranceDays - Days before/after due date to match (default: 7)
 */
export async function findCreditPaymentBillInstance(
  linkedAccountId: string,
  paymentAmount: number,
  paymentDate: string,
  userId: string,
  householdId: string,
  dateToleranceDays: number = 7
): Promise<{ billId: string; instanceId: string; expectedAmount: number } | null> {
  // Find bills linked to this credit account
  const linkedBills = await db
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.linkedAccountId, linkedAccountId),
        eq(bills.userId, userId),
        eq(bills.householdId, householdId),
        eq(bills.isActive, true)
      )
    );

  if (!linkedBills.length) {
    return null;
  }

  // Get pending instances for these bills
  const billIds = linkedBills.map(b => b.id);
  const pendingInstances = await db
    .select()
    .from(billInstances)
    .where(
      and(
        eq(billInstances.userId, userId),
        eq(billInstances.householdId, householdId)
      )
    );

  // Filter to relevant bills and pending status
  const relevantInstances = pendingInstances.filter(
    inst => billIds.includes(inst.billId) && 
    (inst.status === 'pending' || inst.status === 'overdue' || inst.paymentStatus === 'partial')
  );

  if (!relevantInstances.length) {
    return null;
  }

  // Find best matching instance based on date
  const paymentDateObj = new Date(paymentDate);
  let bestMatch: { instance: typeof relevantInstances[0]; dateDiff: number } | null = null;

  for (const instance of relevantInstances) {
    const dueDate = new Date(instance.dueDate);
    const dateDiff = Math.abs(
      Math.floor((paymentDateObj.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Check if within tolerance
    if (dateDiff <= dateToleranceDays) {
      // Prefer closest date or overdue instances
      if (!bestMatch || instance.status === 'overdue' || dateDiff < bestMatch.dateDiff) {
        bestMatch = { instance, dateDiff };
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    billId: bestMatch.instance.billId,
    instanceId: bestMatch.instance.id,
    expectedAmount: bestMatch.instance.expectedAmount,
  };
}

/**
 * Get payment history for a bill
 */
export async function getBillPaymentHistory(
  billId: string,
  userId: string,
  householdId: string
): Promise<typeof billPayments.$inferSelect[]> {
  return db
    .select()
    .from(billPayments)
    .where(
      and(
        eq(billPayments.billId, billId),
        eq(billPayments.userId, userId),
        eq(billPayments.householdId, householdId)
      )
    )
    .orderBy(billPayments.paymentDate);
}

/**
 * Get payment history for a specific bill instance
 */
export async function getInstancePaymentHistory(
  instanceId: string,
  userId: string,
  householdId: string
): Promise<typeof billPayments.$inferSelect[]> {
  return db
    .select()
    .from(billPayments)
    .where(
      and(
        eq(billPayments.billInstanceId, instanceId),
        eq(billPayments.userId, userId),
        eq(billPayments.householdId, householdId)
      )
    )
    .orderBy(billPayments.paymentDate);
}

/**
 * Check if a bill payment would be a shortfall (partial payment)
 */
export function checkPaymentShortfall(
  paymentAmount: number,
  expectedAmount: number,
  previousPaidAmount: number = 0
): { isShortfall: boolean; shortfallAmount: number; paymentPercentage: number } {
  const payment = new Decimal(paymentAmount);
  const expected = new Decimal(expectedAmount);
  const previousPaid = new Decimal(previousPaidAmount);
  
  const totalAfterPayment = previousPaid.plus(payment);
  const shortfall = expected.minus(totalAfterPayment);
  const percentage = totalAfterPayment.dividedBy(expected).times(100);

  return {
    isShortfall: shortfall.greaterThan(0),
    shortfallAmount: shortfall.greaterThan(0) ? shortfall.toNumber() : 0,
    paymentPercentage: percentage.toDecimalPlaces(1).toNumber(),
  };
}

