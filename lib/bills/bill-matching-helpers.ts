import { db } from '@/lib/db';
import { billOccurrences, billTemplates } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { parseISO } from 'date-fns';
import {
  findMatchingBills,
  BillForMatching,
  TransactionForMatching,
} from './bill-matcher';
import Decimal from 'decimal.js';

/**
 * Extract day of month from ISO date string (1-31)
 */
function extractDayOfMonth(isoDate: string): number {
  return parseISO(isoDate).getDate();
}

/**
 * Extract day of week from ISO date string (0 = Sunday, 6 = Saturday)
 */
function extractDayOfWeek(isoDate: string): number {
  return parseISO(isoDate).getDay();
}

/**
 * Find matching bill instance for a transaction using matcher utility
 * Returns the best matching instance if confidence >= minConfidence
 * 
 * @param transaction - Transaction data for matching
 * @param userId - User ID for filtering bills
 * @param householdId - Household ID for filtering bills
 * @param minConfidence - Minimum confidence threshold (default: 70)
 * @returns Matching bill/instance info or null if no match found
 */
export async function findMatchingBillInstance(
  transaction: {
    id: string;
    description: string;
    amount: number;
    date: string;
    type: string;
    categoryId?: string | null;
  },
  userId: string,
  householdId: string,
  minConfidence: number = 70
): Promise<{
  billId: string;
  instanceId: string;
  templateId: string;
  occurrenceId: string;
  confidence: number;
} | null> {
  // Only match expense transactions
  if (transaction.type !== 'expense') {
    return null;
  }

  try {
    // Fetch all active bills with pending/overdue instances
    const billsWithInstances = await db
      .select({
        billId: billTemplates.id,
        billName: billTemplates.name,
        defaultAmountCents: billTemplates.defaultAmountCents,
        amountToleranceBps: billTemplates.amountToleranceBps,
        recurrenceType: billTemplates.recurrenceType,
        instanceId: billOccurrences.id,
        dueDate: billOccurrences.dueDate,
        status: billOccurrences.status,
      })
      .from(billTemplates)
      .innerJoin(billOccurrences, eq(billOccurrences.templateId, billTemplates.id))
      .where(
        and(
          eq(billTemplates.createdByUserId, userId),
          eq(billTemplates.householdId, householdId),
          eq(billTemplates.billType, 'expense'),
          eq(billTemplates.isActive, true),
          inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
        )
      );

    if (billsWithInstances.length === 0) {
      return null;
    }

    // Group bills and collect instances
    const billMap = new Map<
      string,
      {
        bill: {
          id: string;
          name: string;
        };
        instances: Array<
          {
            id: string;
            dueDate: string;
            status: 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'overdue' | 'skipped';
            isOverdue: boolean;
          }
        >;
        recurrenceType: string;
        expectedAmount: number;
        amountTolerance: number;
      }
    >();

    for (const row of billsWithInstances) {
      if (!billMap.has(row.billId)) {
        billMap.set(row.billId, {
          bill: {
            id: row.billId,
            name: row.billName,
          },
          instances: [],
          recurrenceType: row.recurrenceType,
          expectedAmount: new Decimal(row.defaultAmountCents).div(100).toNumber(),
          amountTolerance: new Decimal(row.amountToleranceBps).div(100).toNumber(),
        });
      }
      billMap.get(row.billId)!.instances.push({
        id: row.instanceId,
        dueDate: row.dueDate,
        status: row.status,
        isOverdue: row.status === 'overdue',
      });
    }

    // Convert to matcher format
    const billsForMatching: BillForMatching[] = [];
    const instanceMap = new Map<
      string,
      {
        billId: string;
        instanceId: string;
        isOverdue: boolean;
        dueDate: string;
      }
    >();

    for (const [billId, { bill, instances, recurrenceType, expectedAmount, amountTolerance }] of billMap) {
      // Use the oldest instance for matching (prioritize overdue)
      instances.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) {
          return a.isOverdue ? -1 : 1; // Overdue first
        }
        return (
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        ); // Oldest first
      });

      const instance = instances[0];

      // Extract due date based on bill recurrence
      let dueDate: number;
      if (recurrenceType === 'weekly' || recurrenceType === 'biweekly') {
        // For weekly/biweekly, use day of week from instance due date
        dueDate = extractDayOfWeek(instance.dueDate);
      } else {
        // For monthly+, use day of month from instance due date
        dueDate = extractDayOfMonth(instance.dueDate);
      }

      billsForMatching.push({
        id: billId,
        name: bill.name,
        expectedAmount,
        dueDate,
        isVariableAmount: false,
        amountTolerance,
      });

      // Store instance mapping for later retrieval
      instanceMap.set(billId, {
        billId,
        instanceId: instance.id,
        isOverdue: instance.isOverdue,
        dueDate: instance.dueDate,
      });
    }

    // Convert transaction to matcher format
    const transactionForMatching: TransactionForMatching = {
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      date: transaction.date,
      type: transaction.type,
    };

    // Find matching bills
    const matches = await findMatchingBills(
      transactionForMatching,
      billsForMatching
    );

    if (matches.length === 0) {
      return null;
    }

    // Get best match (already sorted by confidence)
    const bestMatch = matches[0];

    if (bestMatch.confidence < minConfidence) {
      return null;
    }

    // Get instance for matched bill
    const instanceInfo = instanceMap.get(bestMatch.billId);
    if (!instanceInfo) {
      return null;
    }

    return {
    billId: bestMatch.billId,
    instanceId: instanceInfo.instanceId,
    templateId: bestMatch.billId,
    occurrenceId: instanceInfo.instanceId,
      confidence: bestMatch.confidence,
    };
  } catch (error) {
    // Log error but don't fail transaction creation
    console.error('Error in bill matching:', error);
    return null;
  }
}


