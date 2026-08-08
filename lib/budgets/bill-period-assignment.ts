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
    // A manual assignment pins the bill to a period NUMBER, but the number
    // alone repeats every month — so it must also fall in this period's
    // neighbourhood (bug-hunt finding P5). The old check accepted any due date
    // in the period's start month OR end month, so with a period spanning a
    // month boundary a single bill matched TWO periods sharing a number and was
    // counted in both. A generous buffer keeps the "assign it to this period
    // even though it's due just outside" behaviour the feature exists for.
    return dueDateBelongsToAssignedPeriod(dueDate, period);
  }

  const rangeStart = subDays(period.start, automaticBufferDays);
  const rangeEnd = addDays(period.end, automaticBufferDays);
  return dueDateObj >= rangeStart && dueDateObj <= rangeEnd;
}

/**
 * For period-NUMBER assignments, decide whether a due date belongs to this
 * specific period instance.
 *
 * A period number repeats every month, so the number alone is ambiguous — the
 * due date's calendar month disambiguates WHICH month's period N is meant.
 * This deliberately does NOT constrain the due date to the period's own date
 * range: assigning a bill due late in the month to the month's FIRST paycheck
 * period (pay it early) is the feature this assignment exists for.
 *
 * The period's owning month is the month of its START, matching how
 * getPeriodPositionInMonth numbers it. The old check accepted the start month
 * OR the end month, so a period spanning a month boundary also claimed bills
 * belonging to the NEXT month's period with the same number — one bill counted
 * in two periods (bug-hunt finding P5).
 */
export function dueDateBelongsToAssignedPeriod(
  dueDate: string,
  period: BudgetPeriod
): boolean {
  // Compare against the period's OWNING month — the same month its number was
  // assigned within — so numbering and membership can never disagree.
  return dueDate.slice(0, 7) === period.owningMonth;
}
