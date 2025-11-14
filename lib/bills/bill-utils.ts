/**
 * Bill Utilities - Helper functions and constants for bill management
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
 * Get the number of bill instances to create based on frequency
 */
export function getInstanceCount(frequency: string): number {
  switch (frequency) {
    case 'one-time':
      return 1; // Only one instance ever
    case 'weekly':
      return 8; // ~2 months ahead
    case 'biweekly':
      return 4; // ~2 months ahead
    case 'monthly':
      return 3; // 3 months ahead
    case 'quarterly':
      return 3; // ~9 months ahead
    case 'semi-annual':
      return 2; // ~1 year ahead
    case 'annual':
      return 2; // ~2 years ahead
    default:
      return 3;
  }
}

/**
 * Calculate the next due date for a bill instance
 *
 * @param frequency - The bill frequency
 * @param dueDate - Day of month (1-31) for month-based, day of week (0-6) for week-based, ignored for one-time
 * @param specificDueDate - ISO date string for one-time bills
 * @param currentDate - The reference date to calculate from
 * @param instanceIndex - The instance number (0 for first, 1 for second, etc.)
 * @returns ISO date string (YYYY-MM-DD)
 */
export function calculateNextDueDate(
  frequency: string,
  dueDate: number,
  specificDueDate: string | null,
  currentDate: Date,
  instanceIndex: number
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

      return weeklyDate.toISOString().split('T')[0];
    }

    case 'biweekly': {
      // dueDate is day of week (0-6)
      const biweeklyDate = new Date(currentDate);
      const currentDayBiweekly = biweeklyDate.getDay();
      const daysUntilDueBiweekly = (dueDate - currentDayBiweekly + 7) % 7;

      // If the due day is today, schedule for 2 weeks from now
      const daysToAdd = daysUntilDueBiweekly === 0 && instanceIndex === 0 ? 14 : daysUntilDueBiweekly;
      biweeklyDate.setDate(biweeklyDate.getDate() + daysToAdd + (instanceIndex * 14));

      return biweeklyDate.toISOString().split('T')[0];
    }

    case 'monthly':
    case 'quarterly':
    case 'semi-annual':
    case 'annual': {
      // Existing month-based logic
      const monthIncrement = frequency === 'monthly' ? 1
        : frequency === 'quarterly' ? 3
        : frequency === 'semi-annual' ? 6
        : 12;

      const monthsToAdd = instanceIndex * monthIncrement;
      let month = (currentDate.getMonth() + monthsToAdd) % 12;
      let year = currentDate.getFullYear() + Math.floor((currentDate.getMonth() + monthsToAdd) / 12);

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const instanceDueDate = Math.min(dueDate, daysInMonth);

      return new Date(year, month, instanceDueDate).toISOString().split('T')[0];
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
 * @returns Formatted string for display
 */
export function formatDueDateDisplay(
  frequency: string,
  dueDate: number | null,
  specificDueDate: string | null
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
  } else if (dueDate !== null) {
    return `Day ${dueDate} of month`;
  }
  return 'Not set';
}
