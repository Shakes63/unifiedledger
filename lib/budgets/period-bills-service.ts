import { and, eq, inArray } from 'drizzle-orm';
import {
  legacyStatusesToOccurrenceStatuses,
  toLegacyAllocation,
  toLegacyBill,
  toLegacyInstance,
} from '@/lib/bills-v2/legacy-compat';
import { listOccurrences } from '@/lib/bills-v2/service';
import { db } from '@/lib/db';
import { autopayRules } from '@/lib/db/schema';
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

interface LegacyBillForPeriod {
  id: string;
  name: string;
  billType: BillType;
  categoryId: string | null;
  budgetPeriodAssignment: number | null;
  isAutopayEnabled: boolean;
}

interface LegacyInstanceForPeriod {
  id: string;
  dueDate: string;
  status: BillStatus;
  expectedAmount: number;
  actualAmount: number | null;
  paidAmount: number;
  remainingAmount: number;
  budgetPeriodOverride: number | null;
}

interface LegacyAllocationForPeriod {
  periodNumber: number;
  allocatedAmount: number;
  paidAmount: number;
  isPaid: boolean;
}

export interface PeriodBillRow {
  bill: LegacyBillForPeriod;
  instance: LegacyInstanceForPeriod;
  allocation: LegacyAllocationForPeriod | null;
  allAllocations: Array<LegacyAllocationForPeriod>;
  hasAnyAllocations: boolean;
}

function toLegacyStatusSet(statuses?: BillStatus[]): BillStatus[] {
  if (!statuses || statuses.length === 0) return ['pending', 'overdue'];
  return statuses;
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
  const requestedStatuses = toLegacyStatusSet(statuses);
  const occurrenceStatuses = legacyStatusesToOccurrenceStatuses(requestedStatuses);

  const occurrenceResult = await listOccurrences({
    userId: userId || 'system',
    householdId,
    status: occurrenceStatuses,
    billType,
    from: periodMonthStart,
    to: periodMonthEnd,
    limit: 5000,
    offset: 0,
  });

  let candidateRows = occurrenceResult.data;
  if (excludeBillType) {
    candidateRows = candidateRows.filter((row) => row.template.billType !== excludeBillType);
  }
  if (userId) {
    candidateRows = candidateRows.filter((row) => row.template.createdByUserId === userId);
  }
  if (candidateRows.length === 0) {
    return [];
  }

  const templateIds = [...new Set(candidateRows.map((row) => row.template.id))];
  const autopayByTemplateId = new Map<string, boolean>();
  if (templateIds.length > 0) {
    const autopayRows = await db
      .select({ templateId: autopayRules.templateId, isEnabled: autopayRules.isEnabled })
      .from(autopayRules)
      .where(
        and(
          eq(autopayRules.householdId, householdId),
          inArray(autopayRules.templateId, templateIds)
        )
      );
    for (const row of autopayRows) {
      autopayByTemplateId.set(row.templateId, row.isEnabled);
    }
  }

  const mappedRows = candidateRows
    .map((row) => {
      const legacyBill = toLegacyBill(row.template, {
        isEnabled: autopayByTemplateId.get(row.template.id) || false,
        payFromAccountId: null,
        amountType: 'fixed',
        fixedAmountCents: null,
        daysBeforeDue: 0,
      });
      const legacyInstance = toLegacyInstance(row.occurrence);
      const allAllocations = row.allocations.map((allocation) => toLegacyAllocation(allocation));
      const currentAllocation =
        allAllocations.find((allocation) => allocation.periodNumber === period.periodNumber) || null;

      return {
        bill: {
          id: legacyBill.id,
          name: legacyBill.name,
          billType: legacyBill.billType as BillType,
          categoryId: legacyBill.categoryId,
          budgetPeriodAssignment: legacyBill.budgetPeriodAssignment,
          isAutopayEnabled: legacyBill.isAutopayEnabled || false,
        },
        instance: {
          id: legacyInstance.id,
          dueDate: legacyInstance.dueDate,
          status: legacyInstance.status as BillStatus,
          expectedAmount: legacyInstance.expectedAmount,
          actualAmount: legacyInstance.actualAmount,
          paidAmount: legacyInstance.paidAmount || 0,
          remainingAmount: legacyInstance.remainingAmount || 0,
          budgetPeriodOverride: legacyInstance.budgetPeriodOverride,
        },
        allocation: currentAllocation
          ? {
              periodNumber: currentAllocation.periodNumber,
              allocatedAmount: currentAllocation.allocatedAmount,
              paidAmount: currentAllocation.paidAmount || 0,
              isPaid: currentAllocation.isPaid || false,
            }
          : null,
        allAllocations: allAllocations.map((allocation) => ({
          periodNumber: allocation.periodNumber,
          allocatedAmount: allocation.allocatedAmount,
          paidAmount: allocation.paidAmount || 0,
          isPaid: allocation.isPaid || false,
        })),
        hasAnyAllocations: allAllocations.length > 0,
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
    .sort((left, right) => left.instance.dueDate.localeCompare(right.instance.dueDate));

  return mappedRows;
}
