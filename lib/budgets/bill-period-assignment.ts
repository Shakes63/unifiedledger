import { addDays, parseISO, subDays } from 'date-fns';
import {
  getCurrentBudgetPeriod,
  isDateInPeriod,
  type BudgetPeriod,
  type BudgetScheduleSettings,
} from '@/lib/budgets/budget-schedule';

interface InstancePeriodAssignmentInput {
  dueDate: string;
  settings: BudgetScheduleSettings;
  period: BudgetPeriod;
  billPeriodAssignment: number | null;
  instancePeriodOverride: number | null;
  automaticBufferDays?: number;
}

/**
 * Calculate period number from a date based on settings.
 */
export function calculatePeriodFromDate(
  dateStr: string,
  settings: BudgetScheduleSettings
): number {
  const period = getCurrentBudgetPeriod(settings, parseISO(dateStr));
  return period.periodNumber;
}

/**
 * Determine whether an instance belongs to a budget period using override precedence:
 * instance override > bill default assignment > due-date-derived period.
 */
export function instanceBelongsToPeriod({
  dueDate,
  settings,
  period,
  billPeriodAssignment,
  instancePeriodOverride,
  automaticBufferDays = 3,
}: InstancePeriodAssignmentInput): boolean {
  if (settings.budgetCycleFrequency === 'monthly') {
    return isDateInPeriod(dueDate, period);
  }

  const instancePeriodNumber = instancePeriodOverride ?? billPeriodAssignment ?? calculatePeriodFromDate(dueDate, settings);
  if (instancePeriodNumber !== period.periodNumber) {
    return false;
  }

  const dueDateObj = parseISO(dueDate);
  const hasManualAssignment = billPeriodAssignment !== null || instancePeriodOverride !== null;

  if (hasManualAssignment) {
    return dueDateMatchesPeriodMonth(dueDate, period);
  }

  const rangeStart = subDays(period.start, automaticBufferDays);
  const rangeEnd = addDays(period.end, automaticBufferDays);
  return dueDateObj >= rangeStart && dueDateObj <= rangeEnd;
}

/**
 * For period-number assignments, ensure we only include instances tied to the same
 * calendar month window as the period (handles periods spanning month boundaries).
 */
export function dueDateMatchesPeriodMonth(dueDate: string, period: BudgetPeriod): boolean {
  const dueDateObj = parseISO(dueDate);
  const dueMonth = dueDateObj.getMonth();
  const dueYear = dueDateObj.getFullYear();

  const periodStartMonth = period.start.getMonth();
  const periodStartYear = period.start.getFullYear();
  const periodEndMonth = period.end.getMonth();
  const periodEndYear = period.end.getFullYear();

  return (
    (dueMonth === periodStartMonth && dueYear === periodStartYear) ||
    (dueMonth === periodEndMonth && dueYear === periodEndYear)
  );
}
