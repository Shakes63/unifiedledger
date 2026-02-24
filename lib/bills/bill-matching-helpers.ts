import { db } from '@/lib/db';
import { bills, billInstances } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { parseISO } from 'date-fns';
import { findMatchingBills, BillForMatching, TransactionForMatching } from './bill-matcher';

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
 * Find matching bill instance for a transaction using bill-matcher utility
 * Returns the best matching bill instance if confidence >= minConfidence
 * 
 * @param transaction - Transaction data for matching
 * @param userId - User ID for filtering bills
 * @param householdId - Household ID for filtering bills
 * @param minConfidence - Minimum confidence threshold (default: 70)
 * @returns Matching bill instance info or null if no match found
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
        bill: bills,
        instance: billInstances,
      })
      .from(bills)
      .innerJoin(billInstances, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.householdId, householdId),
          eq(bills.isActive, true),
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId),
          inArray(billInstances.status, ['pending', 'overdue'])
        )
      );

    if (billsWithInstances.length === 0) {
      return null;
    }

    // Group bills by bill ID and collect instances
    const billMap = new Map<
      string,
      {
        bill: typeof bills.$inferSelect;
        instances: Array<
          typeof billInstances.$inferSelect & { isOverdue: boolean }
        >;
      }
    >();

    for (const { bill, instance } of billsWithInstances) {
      if (!billMap.has(bill.id)) {
        billMap.set(bill.id, {
          bill,
          instances: [],
        });
      }
      billMap.get(bill.id)!.instances.push({
        ...instance,
        isOverdue: instance.status === 'overdue',
      });
    }

    // Convert to bill-matcher format
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

    for (const [billId, { bill, instances }] of billMap) {
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

      // Extract due date based on bill frequency
      let dueDate: number;
      if (bill.frequency === 'weekly' || bill.frequency === 'biweekly') {
        // For weekly/biweekly, use day of week from instance due date
        dueDate = extractDayOfWeek(instance.dueDate);
      } else {
        // For monthly+, use day of month from instance due date
        dueDate = extractDayOfMonth(instance.dueDate);
      }

      // Parse payee patterns (stored as JSON string)
      let payeePatterns: string[] = [];
      if (bill.payeePatterns) {
        try {
          const parsed = JSON.parse(bill.payeePatterns);
          payeePatterns = Array.isArray(parsed) ? parsed : [bill.payeePatterns];
        } catch {
          // If not JSON, treat as single pattern
          payeePatterns = [bill.payeePatterns];
        }
      }

      billsForMatching.push({
        id: billId,
        name: bill.name,
        expectedAmount: bill.expectedAmount,
        dueDate,
        isVariableAmount: bill.isVariableAmount ?? false,
        amountTolerance: bill.amountTolerance ?? 5.0,
        payeePatterns: payeePatterns.length > 0 ? payeePatterns : undefined,
      });

      // Store instance mapping for later retrieval
      instanceMap.set(billId, {
        billId,
        instanceId: instance.id,
        isOverdue: instance.isOverdue,
        dueDate: instance.dueDate,
      });
    }

    // Convert transaction to bill-matcher format
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
      confidence: bestMatch.confidence,
    };
  } catch (error) {
    // Log error but don't fail transaction creation
    console.error('Error in bill matching:', error);
    return null;
  }
}
