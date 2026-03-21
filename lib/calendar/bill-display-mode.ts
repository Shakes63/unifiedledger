import { addDays, eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth, subDays } from 'date-fns';

import {
  getCurrentBudgetPeriod,
  getDefaultBudgetScheduleSettings,
  type BudgetScheduleSettings,
} from '@/lib/budgets/budget-schedule';
import {
  dueDateMatchesPeriodMonth,
  instanceBelongsToPeriod,
} from '@/lib/budgets/bill-period-assignment';

export type CalendarBillDisplayMode = 'due-date' | 'budget-cycle';

export function normalizeCalendarBillDisplayMode(
  value: string | null | undefined
): CalendarBillDisplayMode {
  return value === 'budget-cycle' ? 'budget-cycle' : 'due-date';
}

export function getBillCalendarDate(
  dueDate: string,
  billDisplayMode: CalendarBillDisplayMode,
  budgetSettings?: BudgetScheduleSettings,
  billPeriodAssignment?: number | null,
  instancePeriodOverride?: number | null
): string {
  if (billDisplayMode !== 'budget-cycle') {
    return dueDate;
  }

  const settings = budgetSettings ?? getDefaultBudgetScheduleSettings();
  const assignedPeriod = getAssignedBudgetPeriodForBill({
    dueDate,
    settings,
    billPeriodAssignment: billPeriodAssignment ?? null,
    instancePeriodOverride: instancePeriodOverride ?? null,
  });

  return assignedPeriod?.startStr ?? getCurrentBudgetPeriod(settings, parseISO(dueDate)).startStr;
}

export function getBillCalendarQueryEndDate(
  endDate: string,
  billDisplayMode: CalendarBillDisplayMode
): string {
  if (billDisplayMode !== 'budget-cycle') {
    return endDate;
  }

  // Budget-cycle display can pull bills from the next period back onto a paycheck
  // date inside the visible range, especially for weekly/biweekly schedules.
  return format(addDays(parseISO(endDate), 31), 'yyyy-MM-dd');
}

function getAssignedBudgetPeriodForBill({
  dueDate,
  settings,
  billPeriodAssignment,
  instancePeriodOverride,
}: {
  dueDate: string;
  settings: BudgetScheduleSettings;
  billPeriodAssignment: number | null;
  instancePeriodOverride: number | null;
}) {
  const dueDateObj = parseISO(dueDate);
  const windowStart = subDays(startOfMonth(dueDateObj), 31);
  const windowEnd = addDays(endOfMonth(dueDateObj), 31);
  const seenPeriods = new Set<string>();

  for (const day of eachDayOfInterval({ start: windowStart, end: windowEnd })) {
    const period = getCurrentBudgetPeriod(settings, day);
    if (seenPeriods.has(period.startStr)) {
      continue;
    }
    seenPeriods.add(period.startStr);

    if (!dueDateMatchesPeriodMonth(dueDate, period)) {
      continue;
    }

    if (
      instanceBelongsToPeriod({
        dueDate,
        settings,
        period,
        billPeriodAssignment,
        instancePeriodOverride,
      })
    ) {
      return period;
    }
  }

  return null;
}
