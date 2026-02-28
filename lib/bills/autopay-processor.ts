/**
 * Autopay Processor
 * 
 * Batch processes all autopay-enabled bills that are due for processing.
 * Called by the daily cron job at 6:00 AM UTC.
 */

import { db } from '@/lib/db';
import { autopayRules, billOccurrences, billTemplates } from '@/lib/db/schema';
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
 * A bill instance is due for processing when:
 * - Bill has autopay enabled
 * - Instance status is unpaid, partial, or overdue
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
    // Get all autopay-enabled rules
    const rules = await db
      .select()
      .from(autopayRules)
      .where(
        eq(autopayRules.isEnabled, true)
      );

    if (rules.length === 0) {
      return result;
    }

    const templateIds = rules.map((rule) => rule.templateId);
    const templates = await db
      .select()
      .from(billTemplates)
      .where(
        and(
          inArray(billTemplates.id, templateIds),
          eq(billTemplates.isActive, true)
        )
      );

    if (templates.length === 0) {
      return result;
    }

    const templateIdSet = new Set(templates.map((t) => t.id));
    const activeRules = rules.filter((rule) => templateIdSet.has(rule.templateId));

    if (activeRules.length === 0) {
      return result;
    }

    const pendingOccurrences = await db
      .select()
      .from(billOccurrences)
      .where(
        and(
          inArray(
            billOccurrences.templateId,
            activeRules.map((rule) => rule.templateId)
          ),
          inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
        )
      );

    const templateMap = new Map(templates.map((template) => [template.id, template]));
    const ruleMap = new Map(activeRules.map((rule) => [rule.templateId, rule]));

    // Filter instances that should be processed today based on autopayDaysBefore
    const eligibleBillInstances: Array<{
      instance: typeof pendingOccurrences[0];
      bill: FullBillData;
    }> = [];

    for (const instance of pendingOccurrences) {
      const template = templateMap.get(instance.templateId);
      const rule = ruleMap.get(instance.templateId);
      if (!template || !rule) continue;

      // Skip if no autopay account configured
      if (!rule.payFromAccountId) {
        result.skipped++;
        continue;
      }

      // Calculate when this instance should be processed
      const dueDate = parseISO(instance.dueDate);
      const autopayDaysBefore = rule.daysBeforeDue || 0;
      const processingDate = subDays(dueDate, autopayDaysBefore);

      // Check if processing date is today
      if (isSameDay(processingDate, today)) {
        eligibleBillInstances.push({
          instance,
          bill: {
            id: template.id,
            name: template.name,
            userId: template.createdByUserId,
            householdId: template.householdId,
            expectedAmount: template.defaultAmountCents / 100,
            categoryId: template.categoryId,
            merchantId: template.merchantId,
            isAutopayEnabled: rule.isEnabled,
            autopayAccountId: rule.payFromAccountId,
            autopayAmountType: rule.amountType,
            autopayFixedAmount:
              rule.fixedAmountCents !== null ? rule.fixedAmountCents / 100 : null,
            autopayDaysBefore: rule.daysBeforeDue,
            linkedAccountId: template.linkedLiabilityAccountId,
            isDebt: template.debtEnabled,
          },
        });
      }
    }

    // Process each eligible instance
    for (const { instance, bill } of eligibleBillInstances) {
      result.processed++;

      // Convert to the expected types
      const billData: FullBillData = {
        ...bill,
      };

      const instanceData: FullInstanceData = {
        id: instance.id,
        templateId: instance.templateId,
        userId: bill.userId,
        householdId: bill.householdId,
        dueDate: instance.dueDate,
        expectedAmount: instance.amountDueCents / 100,
        paidAmount: instance.amountPaidCents / 100,
        remainingAmount: instance.amountRemainingCents / 100,
        status: instance.status,
        paymentStatus:
          instance.status === 'partial'
            ? 'partial'
            : instance.status === 'paid' || instance.status === 'overpaid'
              ? 'paid'
              : 'unpaid',
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
  
  const rules = await db
    .select()
    .from(autopayRules)
    .where(
      eq(autopayRules.isEnabled, true)
    );

  if (rules.length === 0) {
    return { count: 0, bills: [] };
  }

  const templateIds = rules.map((rule) => rule.templateId);
  const templates = await db
    .select()
    .from(billTemplates)
    .where(and(inArray(billTemplates.id, templateIds), eq(billTemplates.isActive, true)));

  if (templates.length === 0) {
    return { count: 0, bills: [] };
  }

  const templateIdSet = new Set(templates.map((t) => t.id));
  const activeRules = rules.filter((rule) => templateIdSet.has(rule.templateId));
  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const ruleMap = new Map(activeRules.map((r) => [r.templateId, r]));

  const pendingOccurrences = await db
    .select()
    .from(billOccurrences)
    .where(
      and(
        inArray(
          billOccurrences.templateId,
          activeRules.map((rule) => rule.templateId)
        ),
        inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
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

  for (const instance of pendingOccurrences) {
    const template = templateMap.get(instance.templateId);
    const rule = ruleMap.get(instance.templateId);
    if (!template || !rule || !rule.payFromAccountId) continue;

    const dueDate = parseISO(instance.dueDate);
    const processingDate = subDays(dueDate, rule.daysBeforeDue || 0);

    if (isSameDay(processingDate, today)) {
      eligibleBills.push({
        billId: template.id,
        billName: template.name,
        instanceId: instance.id,
        dueDate: instance.dueDate,
        expectedAmount: instance.amountDueCents / 100,
        autopayAccountId: rule.payFromAccountId,
        autopayAmountType: rule.amountType,
      });
    }
  }

  return {
    count: eligibleBills.length,
    bills: eligibleBills,
  };
}

