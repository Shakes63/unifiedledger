/**
 * Template Utilities - Helper functions and constants for recurring template management
 *
 * Supports 7 bill frequencies:
 * - one-time: Single payment on a specific date
 * - weekly: Repeats every 7 days
 * - biweekly: Repeats every 14 days
 * - monthly: Repeats every month
 * - quarterly: Repeats every 3 months
 * - semi-annual: Repeats every 6 months
 * - annual: Repeats once per year
 */

import { format } from 'date-fns';

export const FREQUENCY_LABELS: Record<string, string> = {
  'one-time': 'One Time',
  'weekly': 'Weekly',
  'biweekly': 'Bi-Weekly',
  'monthly': 'Monthly',
  'quarterly': 'Quarterly',
  'semi-annual': 'Semi-Annual',
  'annual': 'Annual',
};

export const FREQUENCY_DESCRIPTIONS: Record<string, string> = {
  'one-time': 'A single payment on a specific date',
  'weekly': 'Repeats every week on the same day',
  'biweekly': 'Repeats every 2 weeks on the same day',
  'monthly': 'Repeats every month on the same day',
  'quarterly': 'Repeats every 3 months',
  'semi-annual': 'Repeats every 6 months',
  'annual': 'Repeats once per year',
};

export const DAY_OF_WEEK_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const MONTH_OPTIONS = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' },
];

/**
 * Check if frequency is week-based (weekly or biweekly)
 */
export function isWeekBasedFrequency(frequency: string): boolean {
  return ['weekly', 'biweekly'].includes(frequency);
}

/**
 * Check if frequency is month-based (monthly, quarterly, semi-annual, annual)
 */
export function isMonthBasedFrequency(frequency: string): boolean {
  return ['monthly', 'quarterly', 'semi-annual', 'annual'].includes(frequency);
}

/**
 * Check if frequency is one-time
 */
export function isOneTimeFrequency(frequency: string): boolean {
  return frequency === 'one-time';
}

/**
 * Check if frequency is non-monthly periodic (quarterly, semi-annual, annual)
 * These frequencies support startMonth selection
 */
export function isNonMonthlyPeriodic(frequency: string): boolean {
  return ['quarterly', 'semi-annual', 'annual'].includes(frequency);
}

/**
 * Get ordinal suffix for a day number (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Format a month value (0-11) for display
 */
export function formatStartMonthDisplay(startMonth: number | null | undefined): string {
  if (startMonth === null || startMonth === undefined) {
    return '';
  }
  const monthOption = MONTH_OPTIONS.find(m => m.value === startMonth);
  return monthOption ? monthOption.label : '';
}

/**
 * Get the appropriate label for the due date field based on frequency
 */
export function getDueDateLabel(frequency: string): string {
  if (isOneTimeFrequency(frequency)) {
    return 'Due Date';
  } else if (isWeekBasedFrequency(frequency)) {
    return 'Day of Week';
  } else {
    return 'Due Date (Day of Month)';
  }
}

/**
 * Get the appropriate placeholder for the due date field based on frequency
 */
export function getDueDatePlaceholder(frequency: string): string {
  if (isOneTimeFrequency(frequency)) {
    return 'Select date';
  } else if (isWeekBasedFrequency(frequency)) {
    return 'Select day of week';
  } else {
    return '1';
  }
}

/**
 * Get the number of occurrences to create based on frequency
 */
export function getInstanceCount(frequency: string): number {
  switch (frequency) {
    case 'one-time':
      return 1; // Only one occurrence ever
    case 'weekly':
      return 8; // ~2 months ahead
    case 'biweekly':
      return 4; // ~2 months ahead
    case 'monthly':
      return 3; // 3 months ahead
    case 'quarterly':
      return 4; // Full year (4 quarters)
    case 'semi-annual':
      return 4; // ~2 years ahead (ensures both occurrences visible per year)
    case 'annual':
      return 2; // ~2 years ahead
    default:
      return 3;
  }
}

/**
 * Calculate the next due date for a template occurrence
 *
 * @param frequency - The bill frequency
 * @param dueDate - Day of month (1-31) for month-based, day of week (0-6) for week-based, ignored for one-time
 * @param specificDueDate - ISO date string for one-time bills
 * @param currentDate - The reference date to calculate from
 * @param instanceIndex - The occurrence number (0 for first, 1 for second, etc.)
 * @param startMonth - Optional starting month (0-11) for non-monthly periodic bills (quarterly/semi-annual/annual)
 * @returns ISO date string (YYYY-MM-DD)
 */
export function calculateNextDueDate(
  frequency: string,
  dueDate: number,
  specificDueDate: string | null,
  currentDate: Date,
  instanceIndex: number,
  startMonth?: number | null
): string {
  switch (frequency) {
    case 'one-time':
      // Use specific due date provided
      if (!specificDueDate) {
        throw new Error('Specific due date required for one-time bills');
      }
      return specificDueDate;

    case 'weekly': {
      // dueDate is day of week (0-6)
      const weeklyDate = new Date(currentDate);
      const currentDay = weeklyDate.getDay();
      const daysUntilDue = (dueDate - currentDay + 7) % 7;

      // If the due day is today, schedule for next week
      const daysToAdd = daysUntilDue === 0 && instanceIndex === 0 ? 7 : daysUntilDue;
      weeklyDate.setDate(weeklyDate.getDate() + daysToAdd + (instanceIndex * 7));

      return format(weeklyDate, 'yyyy-MM-dd');
    }

    case 'biweekly': {
      // dueDate is day of week (0-6)
      const biweeklyDate = new Date(currentDate);
      const currentDayBiweekly = biweeklyDate.getDay();
      const daysUntilDueBiweekly = (dueDate - currentDayBiweekly + 7) % 7;

      // If the due day is today, schedule for 2 weeks from now
      const daysToAdd = daysUntilDueBiweekly === 0 && instanceIndex === 0 ? 14 : daysUntilDueBiweekly;
      biweeklyDate.setDate(biweeklyDate.getDate() + daysToAdd + (instanceIndex * 14));

      return format(biweeklyDate, 'yyyy-MM-dd');
    }

    case 'monthly': {
      // Monthly bills always use current month as base
      const monthsToAdd = instanceIndex;
      const month = (currentDate.getMonth() + monthsToAdd) % 12;
      const year = currentDate.getFullYear() + Math.floor((currentDate.getMonth() + monthsToAdd) / 12);

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const instanceDueDate = Math.min(dueDate, daysInMonth);

      return format(new Date(year, month, instanceDueDate), 'yyyy-MM-dd');
    }

    case 'quarterly':
    case 'semi-annual':
    case 'annual': {
      // Non-monthly periodic bills support startMonth selection
      const monthIncrement = frequency === 'quarterly' ? 3
        : frequency === 'semi-annual' ? 6
        : 12;

      // Calculate base month and year
      let baseMonth: number;
      let baseYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      const currentDay = currentDate.getDate();

      if (startMonth !== undefined && startMonth !== null) {
        // User specified a start month
        baseMonth = startMonth;

        // Determine if we need to use the next occurrence
        // Check if the specified start month/day has already passed this cycle
        if (startMonth < currentMonth || 
            (startMonth === currentMonth && dueDate < currentDay)) {
          // For quarterly bills, find the next occurrence in the cycle
          if (frequency === 'quarterly') {
            // Find which occurrence of this quarterly cycle we're past
            // Quarters for startMonth: startMonth, startMonth+3, startMonth+6, startMonth+9
            let nextOccurrence = startMonth;
            while (nextOccurrence < currentMonth || 
                   (nextOccurrence === currentMonth && dueDate < currentDay)) {
              nextOccurrence += monthIncrement;
            }
            if (nextOccurrence >= 12) {
              baseYear += Math.floor(nextOccurrence / 12);
              nextOccurrence = nextOccurrence % 12;
            }
            baseMonth = nextOccurrence;
          } else {
            // For semi-annual and annual, just add one increment to get next occurrence
            baseMonth = startMonth + monthIncrement;
            if (baseMonth >= 12) {
              baseYear += Math.floor(baseMonth / 12);
              baseMonth = baseMonth % 12;
            }
          }
        }
      } else {
        // Legacy behavior: start from current month
        baseMonth = currentMonth;
      }

      // Add increments for subsequent instances
      const totalMonthsFromBase = instanceIndex * monthIncrement;
      let month = baseMonth + totalMonthsFromBase;
      let year = baseYear;
      
      if (month >= 12) {
        year += Math.floor(month / 12);
        month = month % 12;
      }

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const instanceDueDate = Math.min(dueDate, daysInMonth);

      return format(new Date(year, month, instanceDueDate), 'yyyy-MM-dd');
    }

    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

/**
 * Format a due date for display based on the bill frequency
 *
 * @param frequency - The bill frequency
 * @param dueDate - Day of month (1-31) or day of week (0-6)
 * @param specificDueDate - ISO date string for one-time bills
 * @param startMonth - Optional starting month (0-11) for non-monthly periodic bills
 * @returns Formatted string for display
 */
export function formatDueDateDisplay(
  frequency: string,
  dueDate: number | null,
  specificDueDate: string | null,
  startMonth?: number | null
): string {
  if (isOneTimeFrequency(frequency) && specificDueDate) {
    const date = new Date(specificDueDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } else if (isWeekBasedFrequency(frequency) && dueDate !== null) {
    const dayOption = DAY_OF_WEEK_OPTIONS.find(d => d.value === dueDate);
    return dayOption ? dayOption.label : `Day ${dueDate}`;
  } else if (isNonMonthlyPeriodic(frequency) && dueDate !== null) {
    // For quarterly/semi-annual/annual, show month name if startMonth is set
    if (startMonth !== null && startMonth !== undefined) {
      const monthLabel = formatStartMonthDisplay(startMonth);
      return `${monthLabel} ${dueDate}${getOrdinalSuffix(dueDate)}`;
    }
    return `Day ${dueDate} of month`;
  } else if (dueDate !== null) {
    // Monthly bills
    return `Day ${dueDate} of month`;
  }
  return 'Not set';
}
