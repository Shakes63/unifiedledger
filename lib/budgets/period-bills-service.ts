import { db } from '@/lib/db';
import {
  bills,
  billInstances,
  billInstanceAllocations,
} from '@/lib/db/schema';
import { and, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import {
  dueDateMatchesPeriodMonth,
  instanceBelongsToPeriod,
} from '@/lib/budgets/bill-period-assignment';
import type {
  BudgetPeriod,
  BudgetScheduleSettings,
} from '@/lib/budgets/budget-schedule';

type BillStatus = 'pending' | 'paid' | 'overdue' | 'skipped';
type BillType = 'expense' | 'income' | 'savings_transfer';

export interface GetPeriodBillsOptions {
  householdId: string;
  settings: BudgetScheduleSettings;
  period: BudgetPeriod;
  statuses?: BillStatus[];
  billType?: BillType;
  excludeBillType?: BillType;
  userId?: string;
}

export interface PeriodBillRow {
  bill: typeof bills.$inferSelect;
  instance: typeof billInstances.$inferSelect;
  allocation: typeof billInstanceAllocations.$inferSelect | null;
  allAllocations: Array<typeof billInstanceAllocations.$inferSelect>;
  hasAnyAllocations: boolean;
}

/**
 * Returns bill instances belonging to the requested budget period using shared
 * assignment logic (instance override > bill default > due date), with split
 * allocations prioritized when present.
 */
export async function getPeriodBillsForBudgetPeriod({
  householdId,
  settings,
  period,
  statuses,
  billType,
  excludeBillType,
  userId,
}: GetPeriodBillsOptions): Promise<PeriodBillRow[]> {
  const periodMonthStart = format(startOfMonth(period.start), 'yyyy-MM-dd');
  const periodMonthEnd = format(endOfMonth(period.end), 'yyyy-MM-dd');

  const whereConditions = [
    eq(bills.householdId, householdId),
    eq(bills.isActive, true),
    gte(billInstances.dueDate, periodMonthStart),
    lte(billInstances.dueDate, periodMonthEnd),
  ];

  if (statuses && statuses.length > 0) {
    whereConditions.push(inArray(billInstances.status, statuses));
  }

  if (billType) {
    whereConditions.push(eq(bills.billType, billType));
  }

  if (excludeBillType) {
    whereConditions.push(ne(bills.billType, excludeBillType));
  }

  if (userId) {
    whereConditions.push(eq(billInstances.userId, userId));
  }

  const candidateRows = await db
    .select({
      bill: bills,
      instance: billInstances,
    })
    .from(billInstances)
    .innerJoin(bills, eq(billInstances.billId, bills.id))
    .where(and(...whereConditions))
    .orderBy(billInstances.dueDate);

  if (candidateRows.length === 0) {
    return [];
  }

  const instanceIds = candidateRows.map((row) => row.instance.id);
  const allocations = await db
    .select()
    .from(billInstanceAllocations)
    .where(
      and(
        eq(billInstanceAllocations.householdId, householdId),
        inArray(billInstanceAllocations.billInstanceId, instanceIds)
      )
    );

  const allocationsByInstanceId = new Map<string, Array<typeof billInstanceAllocations.$inferSelect>>();
  for (const allocation of allocations) {
    const existing = allocationsByInstanceId.get(allocation.billInstanceId) || [];
    existing.push(allocation);
    allocationsByInstanceId.set(allocation.billInstanceId, existing);
  }

  const sortedRows = candidateRows
    .map((row) => {
      const instanceAllocations = allocationsByInstanceId.get(row.instance.id) || [];
      const currentAllocation = instanceAllocations.find((a) => a.periodNumber === period.periodNumber) || null;
      return {
        bill: row.bill,
        instance: row.instance,
        allocation: currentAllocation,
        allAllocations: instanceAllocations,
        hasAnyAllocations: instanceAllocations.length > 0,
      } satisfies PeriodBillRow;
    })
    .filter((row) => {
      if (row.hasAnyAllocations) {
        if (!row.allocation) {
          return false;
        }
        return dueDateMatchesPeriodMonth(row.instance.dueDate, period);
      }

      return instanceBelongsToPeriod({
        dueDate: row.instance.dueDate,
        settings,
        period,
        billPeriodAssignment: row.bill.budgetPeriodAssignment,
        instancePeriodOverride: row.instance.budgetPeriodOverride,
      });
    })
    .sort((a, b) => a.instance.dueDate.localeCompare(b.instance.dueDate));

  return sortedRows;
}
