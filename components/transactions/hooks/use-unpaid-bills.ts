'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Bill, BillInstance } from '@/lib/types';
import type { BillOccurrenceWithTemplateDto } from '@/lib/bills/contracts';

type HouseholdFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface UnpaidBillWithInstance {
  bill: Bill;
  instance: BillInstance;
}

interface UseUnpaidBillsOptions {
  enabled: boolean;
  fetchWithHousehold: HouseholdFetch;
}

interface UseUnpaidBillsResult {
  unpaidBills: UnpaidBillWithInstance[];
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
}

function mapOccurrenceRows(rows: BillOccurrenceWithTemplateDto[]): UnpaidBillWithInstance[] {
  return rows.map((row) => {
    const template = row.template;
    const occurrence = row.occurrence;
    const frequency =
      template.recurrenceType === 'one_time'
        ? 'one-time'
        : template.recurrenceType === 'semi_annual'
          ? 'semi-annual'
          : template.recurrenceType;
    const dueDateNumber =
      template.recurrenceType === 'weekly' || template.recurrenceType === 'biweekly'
        ? template.recurrenceDueWeekday ?? 0
        : template.recurrenceType === 'one_time'
          ? Number(template.recurrenceSpecificDueDate?.split('-')[2] || '1')
          : template.recurrenceDueDay ?? 1;

    const bill: Bill = {
      id: template.id,
      userId: template.createdByUserId,
      householdId: template.householdId,
      name: template.name,
      categoryId: template.categoryId,
      merchantId: template.merchantId,
      debtId: null,
      expectedAmount: template.defaultAmountCents / 100,
      dueDate: dueDateNumber,
      frequency,
      specificDueDate: template.recurrenceSpecificDueDate,
      startMonth: template.recurrenceStartMonth,
      isVariableAmount: template.isVariableAmount,
      amountTolerance: template.amountToleranceBps / 100,
      payeePatterns: null,
      accountId: template.paymentAccountId,
      isActive: template.isActive,
      autoMarkPaid: template.autoMarkPaid,
      notes: template.notes,
      budgetPeriodAssignment: template.budgetPeriodAssignment,
      splitAcrossPeriods: template.splitAcrossPeriods,
      splitAllocations: null,
      createdAt: template.createdAt,
    };

    const instance: BillInstance = {
      id: occurrence.id,
      userId: '',
      householdId: occurrence.householdId,
      billId: occurrence.templateId,
      dueDate: occurrence.dueDate,
      expectedAmount: occurrence.amountDueCents / 100,
      actualAmount: occurrence.actualAmountCents !== null ? occurrence.actualAmountCents / 100 : null,
      paidDate: occurrence.paidDate,
      transactionId: occurrence.lastTransactionId,
      status:
        occurrence.status === 'paid' || occurrence.status === 'overpaid'
          ? 'paid'
          : occurrence.status === 'overdue'
            ? 'overdue'
            : occurrence.status === 'skipped'
              ? 'skipped'
              : 'pending',
      daysLate: occurrence.daysLate,
      lateFee: occurrence.lateFeeCents / 100,
      isManualOverride: occurrence.isManualOverride,
      notes: occurrence.notes,
      budgetPeriodOverride: occurrence.budgetPeriodOverride,
      paidAmount: occurrence.amountPaidCents / 100,
      remainingAmount: occurrence.amountRemainingCents / 100,
      paymentStatus:
        occurrence.status === 'paid'
          ? 'paid'
          : occurrence.status === 'overpaid'
            ? 'overpaid'
            : occurrence.status === 'partial'
              ? 'partial'
              : 'unpaid',
      principalPaid: undefined,
      interestPaid: undefined,
      createdAt: occurrence.createdAt,
      updatedAt: occurrence.updatedAt,
    };

    return { bill, instance };
  });
}

export function useUnpaidBills({
  enabled,
  fetchWithHousehold,
}: UseUnpaidBillsOptions): UseUnpaidBillsResult {
  const [unpaidBills, setUnpaidBills] = useState<UnpaidBillWithInstance[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnpaidBills([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/bills/occurrences?status=unpaid,partial,overdue&limit=100');
      if (response.ok) {
        const data = await response.json();
        const rows = (Array.isArray(data?.data) ? data.data : []) as BillOccurrenceWithTemplateDto[];
        setUnpaidBills(mapOccurrenceRows(rows));
      } else {
        setUnpaidBills([]);
      }
    } catch {
      setUnpaidBills([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchWithHousehold]);

  useEffect(() => {
    if (!enabled) {
      setUnpaidBills([]);
      setLoading(false);
      return;
    }

    void refresh();
  }, [enabled, refresh]);

  return {
    unpaidBills,
    loading,
    refresh,
    clear: () => setUnpaidBills([]),
  };
}
