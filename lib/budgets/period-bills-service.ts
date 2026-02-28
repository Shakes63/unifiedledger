import { and, eq, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { listOccurrences } from '@/lib/bills/service';
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
type OccurrenceStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'overdue' | 'skipped';

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

function mapBillStatusesToOccurrenceStatuses(statuses: BillStatus[]): OccurrenceStatus[] {
  const mapped = new Set<OccurrenceStatus>();
  for (const status of statuses) {
    if (status === 'pending') {
      mapped.add('unpaid');
      mapped.add('partial');
    } else if (status === 'paid') {
      mapped.add('paid');
      mapped.add('overpaid');
    } else if (status === 'overdue') {
      mapped.add('overdue');
    } else if (status === 'skipped') {
      mapped.add('skipped');
    }
  }
  return Array.from(mapped);
}

function toLegacyStatus(status: OccurrenceStatus): BillStatus {
  if (status === 'paid' || status === 'overpaid') return 'paid';
  if (status === 'overdue') return 'overdue';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

function centsToAmount(cents: number | null | undefined): number {
  return new Decimal(cents || 0).div(100).toNumber();
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
  const occurrenceStatuses = mapBillStatusesToOccurrenceStatuses(requestedStatuses);

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
      const allAllocations = row.allocations.map((allocation) => ({
        periodNumber: allocation.periodNumber,
        allocatedAmount: centsToAmount(allocation.allocatedAmountCents),
        paidAmount: centsToAmount(allocation.paidAmountCents),
        isPaid: allocation.isPaid || false,
      }));
      const currentAllocation =
        allAllocations.find((allocation) => allocation.periodNumber === period.periodNumber) || null;

      return {
        bill: {
          id: row.template.id,
          name: row.template.name,
          billType: row.template.billType as BillType,
          categoryId: row.template.categoryId,
          budgetPeriodAssignment: row.template.budgetPeriodAssignment,
          isAutopayEnabled: autopayByTemplateId.get(row.template.id) || false,
        },
        instance: {
          id: row.occurrence.id,
          dueDate: row.occurrence.dueDate,
          status: toLegacyStatus(row.occurrence.status as OccurrenceStatus),
          expectedAmount: centsToAmount(row.occurrence.amountDueCents),
          actualAmount: row.occurrence.actualAmountCents !== null ? centsToAmount(row.occurrence.actualAmountCents) : null,
          paidAmount: centsToAmount(row.occurrence.amountPaidCents),
          remainingAmount: centsToAmount(row.occurrence.amountRemainingCents),
          budgetPeriodOverride: row.occurrence.budgetPeriodOverride,
        },
        allocation: currentAllocation
          ? {
              periodNumber: currentAllocation.periodNumber,
              allocatedAmount: currentAllocation.allocatedAmount,
              paidAmount: currentAllocation.paidAmount,
              isPaid: currentAllocation.isPaid || false,
            }
          : null,
        allAllocations: allAllocations.map((allocation) => ({
          periodNumber: allocation.periodNumber,
          allocatedAmount: allocation.allocatedAmount,
          paidAmount: allocation.paidAmount,
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
