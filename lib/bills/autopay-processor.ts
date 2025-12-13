/**
 * Autopay Processor
 * 
 * Batch processes all autopay-enabled bills that are due for processing.
 * Called by the daily cron job at 6:00 AM UTC.
 */

import { db } from '@/lib/db';
import { bills, billInstances } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { parseISO, subDays, isSameDay } from 'date-fns';
import { 
  processAutopayForInstance, 
  FullBillData, 
  FullInstanceData 
} from '@/lib/bills/autopay-transaction';
import { 
  sendAutopaySuccessNotification, 
  sendAutopayFailureNotification 
} from '@/lib/notifications/autopay-notifications';

export interface AutopayProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  totalAmount: number;
  errors: Array<{
    billId: string;
    billName: string;
    instanceId: string;
    error: string;
    errorCode?: string;
  }>;
  successes: Array<{
    billId: string;
    billName: string;
    instanceId: string;
    amount: number;
    transactionId?: string;
  }>;
}

/**
 * Process all autopay bills that are due for processing today
 * 
 * A bill is due for processing when:
 * - Bill has autopay enabled
 * - Bill instance status is 'pending' or 'overdue'
 * - (Due date - autopayDaysBefore) = today
 * 
 * For example:
 * - Bill due Jan 15, autopayDaysBefore = 0 -> process on Jan 15
 * - Bill due Jan 15, autopayDaysBefore = 2 -> process on Jan 13
 */
export async function processAllAutopayBills(): Promise<AutopayProcessingResult> {
  const today = new Date();
  
  const result: AutopayProcessingResult = {
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    totalAmount: 0,
    errors: [],
    successes: [],
  };

  try {
    // Get all autopay-enabled bills
    const autopayBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.isAutopayEnabled, true),
          eq(bills.isActive, true)
        )
      );

    if (autopayBills.length === 0) {
      return result;
    }

    // Get bill IDs for filtering instances
    const billIds = autopayBills.map(b => b.id);

    // Get pending instances for these bills
    // We look for instances within a reasonable date range (next 7 days max)
    const pendingInstances = await db
      .select()
      .from(billInstances)
      .where(
        and(
          inArray(billInstances.billId, billIds),
          // Status is pending or overdue
          inArray(billInstances.status, ['pending', 'overdue'])
        )
      );

    // Create a map of bill data for quick lookup
    const billMap = new Map(autopayBills.map(b => [b.id, b]));

    // Filter instances that should be processed today based on autopayDaysBefore
    const eligibleInstances: Array<{
      instance: typeof pendingInstances[0];
      bill: typeof autopayBills[0];
    }> = [];

    for (const instance of pendingInstances) {
      const bill = billMap.get(instance.billId);
      if (!bill) continue;

      // Skip if no autopay account configured
      if (!bill.autopayAccountId) {
        result.skipped++;
        continue;
      }

      // Calculate when this instance should be processed
      const dueDate = parseISO(instance.dueDate);
      const autopayDaysBefore = bill.autopayDaysBefore || 0;
      const processingDate = subDays(dueDate, autopayDaysBefore);

      // Check if processing date is today
      if (isSameDay(processingDate, today)) {
        eligibleInstances.push({ instance, bill });
      }
    }

    // Process each eligible instance
    for (const { instance, bill } of eligibleInstances) {
      result.processed++;

      // Convert to the expected types
      const billData: FullBillData = {
        id: bill.id,
        name: bill.name,
        userId: bill.userId,
        householdId: bill.householdId,
        expectedAmount: bill.expectedAmount,
        categoryId: bill.categoryId,
        merchantId: bill.merchantId,
        isAutopayEnabled: bill.isAutopayEnabled,
        autopayAccountId: bill.autopayAccountId,
        autopayAmountType: bill.autopayAmountType as 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance' | null,
        autopayFixedAmount: bill.autopayFixedAmount,
        autopayDaysBefore: bill.autopayDaysBefore,
        linkedAccountId: bill.linkedAccountId,
        isDebt: bill.isDebt,
      };

      const instanceData: FullInstanceData = {
        id: instance.id,
        billId: instance.billId,
        userId: instance.userId,
        householdId: instance.householdId,
        dueDate: instance.dueDate,
        expectedAmount: instance.expectedAmount,
        paidAmount: instance.paidAmount,
        remainingAmount: instance.remainingAmount,
        status: instance.status,
        paymentStatus: instance.paymentStatus,
      };

      try {
        const autopayResult = await processAutopayForInstance(billData, instanceData);

        if (autopayResult.success) {
          // Zero amount is a success (nothing to pay)
          if (autopayResult.amount > 0) {
            result.successful++;
            result.totalAmount += autopayResult.amount;
            result.successes.push({
              billId: bill.id,
              billName: bill.name,
              instanceId: instance.id,
              amount: autopayResult.amount,
              transactionId: autopayResult.transactionId,
            });

            // Send success notification
            await sendAutopaySuccessNotification(billData, instanceData, autopayResult);
          } else {
            // Nothing to pay - count as skipped
            result.skipped++;
          }
        } else {
          result.failed++;
          result.errors.push({
            billId: bill.id,
            billName: bill.name,
            instanceId: instance.id,
            error: autopayResult.error || 'Unknown error',
            errorCode: autopayResult.errorCode,
          });

          // Send failure notification
          await sendAutopayFailureNotification(billData, instanceData, autopayResult);
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          billId: bill.id,
          billName: bill.name,
          instanceId: instance.id,
          error: error instanceof Error ? error.message : 'Unexpected error',
          errorCode: 'SYSTEM_ERROR',
        });

        // Send failure notification
        await sendAutopayFailureNotification(billData, instanceData, {
          success: false,
          amount: 0,
          error: error instanceof Error ? error.message : 'Unexpected error',
          errorCode: 'SYSTEM_ERROR',
        });
      }
    }

    return result;
  } catch (error) {
    console.error('Error in autopay processor:', error);
    throw error;
  }
}

/**
 * Get a summary of autopay bills due for processing today
 * Useful for debugging or preview without actually processing
 */
export async function getAutopayDueToday(): Promise<{
  count: number;
  bills: Array<{
    billId: string;
    billName: string;
    instanceId: string;
    dueDate: string;
    expectedAmount: number;
    autopayAccountId: string;
    autopayAmountType: string | null;
  }>;
}> {
  const today = new Date();
  
  const autopayBills = await db
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.isAutopayEnabled, true),
        eq(bills.isActive, true)
      )
    );

  if (autopayBills.length === 0) {
    return { count: 0, bills: [] };
  }

  const billIds = autopayBills.map(b => b.id);
  const billMap = new Map(autopayBills.map(b => [b.id, b]));

  const pendingInstances = await db
    .select()
    .from(billInstances)
    .where(
      and(
        inArray(billInstances.billId, billIds),
        inArray(billInstances.status, ['pending', 'overdue'])
      )
    );

  const eligibleBills: Array<{
    billId: string;
    billName: string;
    instanceId: string;
    dueDate: string;
    expectedAmount: number;
    autopayAccountId: string;
    autopayAmountType: string | null;
  }> = [];

  for (const instance of pendingInstances) {
    const bill = billMap.get(instance.billId);
    if (!bill || !bill.autopayAccountId) continue;

    const dueDate = parseISO(instance.dueDate);
    const processingDate = subDays(dueDate, bill.autopayDaysBefore || 0);

    if (isSameDay(processingDate, today)) {
      eligibleBills.push({
        billId: bill.id,
        billName: bill.name,
        instanceId: instance.id,
        dueDate: instance.dueDate,
        expectedAmount: instance.expectedAmount,
        autopayAccountId: bill.autopayAccountId,
        autopayAmountType: bill.autopayAmountType,
      });
    }
  }

  return {
    count: eligibleBills.length,
    bills: eligibleBills,
  };
}

