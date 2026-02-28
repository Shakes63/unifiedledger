/**
 * Template Payment Utilities
 * 
 * Central utility for processing template payments with support for:
 * - Full payments
 * - Partial payments with shortfall tracking
 * - Overpayments
 * - Debt template payments with principal/interest breakdown
 * - Payment history recording
 */

import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { billOccurrences, billPaymentEvents, billTemplates } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { calculatePaymentBreakdown, PaymentBreakdown } from '@/lib/debts/payment-calculator';
import { classifyInterestPayment } from '@/lib/tax/interest-tax-utils';

export interface ProcessBillPaymentParams {
  billId?: string;
  instanceId?: string;
  templateId?: string;
  occurrenceId?: string;
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
 * 2. Creates a template payment event record
 * 3. Updates the occurrence with payment tracking
 * 4. For debt templates, calculates principal/interest split and updates remaining balance
 * 
 * @returns BillPaymentResult with payment details and status
 */
export async function processBillPayment({
  billId,
  instanceId,
  templateId,
  occurrenceId,
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
    const resolvedBillId = billId ?? templateId;
    const resolvedInstanceId = instanceId ?? occurrenceId;
    if (!resolvedBillId || !resolvedInstanceId) {
      return {
        success: false,
        paymentId: '',
        paymentStatus: 'unpaid',
        paidAmount: 0,
        remainingAmount: 0,
        error: 'Bill ID and instance ID are required',
      };
    }

    const [joined] = await db
      .select({
        template: billTemplates,
        occurrence: billOccurrences,
      })
      .from(billOccurrences)
      .innerJoin(billTemplates, eq(billTemplates.id, billOccurrences.templateId))
      .where(
        and(
          eq(billTemplates.id, resolvedBillId),
          eq(billTemplates.createdByUserId, userId),
          eq(billTemplates.householdId, householdId),
          eq(billOccurrences.id, resolvedInstanceId),
          eq(billOccurrences.householdId, householdId)
        )
      )
      .limit(1);

    if (!joined) {
      return {
        success: false,
        paymentId: '',
        paymentStatus: 'unpaid',
        paidAmount: 0,
        remainingAmount: 0,
        error: 'Bill or instance not found',
      };
    }

    const { template, occurrence } = joined;

    // Calculate payment amounts using Decimal.js for precision
    const payment = new Decimal(paymentAmount);
    const expectedAmount = new Decimal(occurrence.amountDueCents).div(100);
    const previousPaidAmount = new Decimal(occurrence.amountPaidCents || 0).div(100);
    const newTotalPaid = previousPaidAmount.plus(payment);
    const remaining = expectedAmount.minus(newTotalPaid);

    // Determine payment status
    let paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overpaid';
    let occurrenceStatus: 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'overdue' | 'skipped' =
      occurrence.status;

    if (newTotalPaid.lessThan(expectedAmount)) {
      paymentStatus = 'partial';
      occurrenceStatus = paymentDate > occurrence.dueDate ? 'overdue' : 'partial';
    } else if (newTotalPaid.equals(expectedAmount)) {
      paymentStatus = 'paid';
      occurrenceStatus = 'paid';
    } else {
      paymentStatus = 'overpaid';
      occurrenceStatus = 'overpaid';
    }

    // Handle debt templates - calculate principal/interest breakdown
    let breakdown: PaymentBreakdown | null = null;
    let newDebtBalance: number | undefined;
    let balanceBeforePayment: number | undefined;
    let balanceAfterPayment: number | undefined;

    const templateDebtBalance =
      template.debtRemainingBalanceCents !== null
        ? new Decimal(template.debtRemainingBalanceCents).div(100).toNumber()
        : null;

    if (template.debtEnabled && templateDebtBalance !== null) {
      balanceBeforePayment = templateDebtBalance;
      
      // Calculate payment breakdown
      breakdown = calculatePaymentBreakdown(
        paymentAmount,
        templateDebtBalance,
        template.debtInterestAprBps ? new Decimal(template.debtInterestAprBps).div(100).toNumber() : 0,
        (template.debtInterestType as 'fixed' | 'variable' | 'none') || 'none',
        'installment', // Debt bills are typically installment loans
        'monthly',
        30
      );

      // Calculate new balance
      newDebtBalance = Math.max(0, templateDebtBalance - breakdown.principalAmount);
      balanceAfterPayment = newDebtBalance;
    }

    // Create payment record ID
    const paymentId = nanoid();
    const now = new Date().toISOString();

    // Batch all database operations
    const dbOperations: Promise<unknown>[] = [
      // Create template payment event record
      db.insert(billPaymentEvents).values({
        id: paymentId,
        householdId,
        templateId: resolvedBillId,
        occurrenceId: resolvedInstanceId,
        transactionId,
        amountCents: new Decimal(paymentAmount).times(100).toDecimalPlaces(0).toNumber(),
        principalCents:
          breakdown?.principalAmount !== undefined
            ? new Decimal(breakdown.principalAmount).times(100).toDecimalPlaces(0).toNumber()
            : null,
        interestCents:
          breakdown?.interestAmount !== undefined
            ? new Decimal(breakdown.interestAmount).times(100).toDecimalPlaces(0).toNumber()
            : null,
        paymentDate: paymentDate.slice(0, 10),
        paymentMethod,
        sourceAccountId: linkedAccountId || null,
        balanceBeforeCents:
          balanceBeforePayment !== undefined
            ? new Decimal(balanceBeforePayment).times(100).toDecimalPlaces(0).toNumber()
            : null,
        balanceAfterCents:
          balanceAfterPayment !== undefined
            ? new Decimal(balanceAfterPayment).times(100).toDecimalPlaces(0).toNumber()
            : null,
        notes: notes || null,
        createdAt: now,
      }),

      // Update occurrence
      db.update(billOccurrences)
        .set({
          amountPaidCents: new Decimal(newTotalPaid).times(100).toDecimalPlaces(0).toNumber(),
          amountRemainingCents: Math.max(
            0,
            new Decimal(remaining).times(100).toDecimalPlaces(0).toNumber()
          ),
          status: occurrenceStatus,
          paidDate:
            paymentStatus === 'paid' || paymentStatus === 'overpaid'
              ? paymentDate.slice(0, 10)
              : occurrence.paidDate,
          lastTransactionId: transactionId,
          actualAmountCents: new Decimal(newTotalPaid).times(100).toDecimalPlaces(0).toNumber(),
          updatedAt: now,
        })
        .where(eq(billOccurrences.id, resolvedInstanceId)),
    ];

    // If debt-enabled template, update remaining balance
    if (template.debtEnabled && newDebtBalance !== undefined) {
      dbOperations.push(
        db.update(billTemplates)
          .set({
            debtRemainingBalanceCents: new Decimal(newDebtBalance)
              .times(100)
              .toDecimalPlaces(0)
              .toNumber(),
            updatedAt: now,
          })
          .where(eq(billTemplates.id, resolvedBillId))
      );
    }

    // Execute all operations in parallel
    await Promise.all(dbOperations);

    // Phase 11: Auto-classify interest for tax deduction if applicable
    let taxDeductionInfo: BillPaymentResult['taxDeductionInfo'];
    if (
      template.debtEnabled &&
      template.interestTaxDeductible &&
      template.interestTaxDeductionType !== 'none' &&
      breakdown?.interestAmount &&
      breakdown.interestAmount > 0
    ) {
      try {
        const taxResult = await classifyInterestPayment(
          userId,
          householdId,
          resolvedBillId,
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
    console.error('Error processing template payment:', error);
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
 * the appropriate instance to mark as paid.
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
): Promise<{
  billId: string;
  instanceId: string;
  templateId: string;
  occurrenceId: string;
  expectedAmount: number;
} | null> {
  // Find templates linked to this liability account
  const linkedTemplates = await db
    .select({ id: billTemplates.id })
    .from(billTemplates)
    .where(
      and(
        eq(billTemplates.linkedLiabilityAccountId, linkedAccountId),
        eq(billTemplates.createdByUserId, userId),
        eq(billTemplates.householdId, householdId),
        eq(billTemplates.billType, 'expense'),
        eq(billTemplates.isActive, true)
      )
    );

  if (!linkedTemplates.length) {
    return null;
  }

  const templateIds = linkedTemplates.map((b) => b.id);
  const pendingOccurrences = await db
    .select()
    .from(billOccurrences)
    .where(
      and(
        inArray(billOccurrences.templateId, templateIds),
        eq(billOccurrences.householdId, householdId),
        inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
      )
    );

  if (!pendingOccurrences.length) {
    return null;
  }

  // Find best matching occurrence based on date
  const paymentDateObj = new Date(paymentDate);
  let bestMatch: { occurrence: typeof pendingOccurrences[0]; dateDiff: number } | null = null;

  for (const occurrence of pendingOccurrences) {
    const dueDate = new Date(occurrence.dueDate);
    const dateDiff = Math.abs(
      Math.floor((paymentDateObj.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Check if within tolerance
    if (dateDiff <= dateToleranceDays) {
      // Prefer closest date or overdue instances
      if (!bestMatch || occurrence.status === 'overdue' || dateDiff < bestMatch.dateDiff) {
        bestMatch = { occurrence, dateDiff };
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    billId: bestMatch.occurrence.templateId,
    instanceId: bestMatch.occurrence.id,
    templateId: bestMatch.occurrence.templateId,
    occurrenceId: bestMatch.occurrence.id,
    expectedAmount: new Decimal(bestMatch.occurrence.amountDueCents).div(100).toNumber(),
  };
}

/**
 * Get payment history for a template
 */
export async function getBillPaymentHistory(
  billId: string,
  _userId: string,
  householdId: string
): Promise<typeof billPaymentEvents.$inferSelect[]> {
  return db
    .select()
    .from(billPaymentEvents)
    .where(
      and(
        eq(billPaymentEvents.templateId, billId),
        eq(billPaymentEvents.householdId, householdId)
      )
    )
    .orderBy(billPaymentEvents.paymentDate);
}

/**
 * Get payment history for a specific occurrence
 */
export async function getInstancePaymentHistory(
  instanceId: string,
  _userId: string,
  householdId: string
): Promise<typeof billPaymentEvents.$inferSelect[]> {
  return db
    .select()
    .from(billPaymentEvents)
    .where(
      and(
        eq(billPaymentEvents.occurrenceId, instanceId),
        eq(billPaymentEvents.householdId, householdId)
      )
    )
    .orderBy(billPaymentEvents.paymentDate);
}

/**
 * Check if a template payment would be a shortfall (partial payment)
 */
export function checkPaymentShortfall(
  paymentAmount: number,
  expectedAmount: number,
  previousPaidAmount: number = 0
): { isShortfall: boolean; shortfallAmount: number; paymentPercentage: number } {
  const payment = new Decimal(paymentAmount);
  const expected = new Decimal(expectedAmount);
  const previousPaid = new Decimal(previousPaidAmount);

  if (expected.lte(0)) {
    return {
      isShortfall: false,
      shortfallAmount: 0,
      paymentPercentage: 100,
    };
  }
  
  const totalAfterPayment = previousPaid.plus(payment);
  const shortfall = expected.minus(totalAfterPayment);
  const percentage = totalAfterPayment.dividedBy(expected).times(100);

  return {
    isShortfall: shortfall.greaterThan(0),
    shortfallAmount: shortfall.greaterThan(0) ? shortfall.toNumber() : 0,
    paymentPercentage: percentage.toDecimalPlaces(1).toNumber(),
  };
}


