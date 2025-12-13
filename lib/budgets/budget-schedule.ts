import Decimal from 'decimal.js';
import {
  format,
  addDays,
  addWeeks,
  startOfDay,
  endOfDay,
  differenceInDays,
  getDay,
  setDay,
  isAfter,
  isBefore,
  isSameDay,
  startOfMonth,
  endOfMonth,
  getDate,
  setDate,
  addMonths,
} from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

export type BudgetCycleFrequency = 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly';

export interface BudgetScheduleSettings {
  budgetCycleFrequency: BudgetCycleFrequency;
  budgetCycleStartDay: number | null; // 0-6 for day of week (0=Sunday, 6=Saturday)
  budgetCycleReferenceDate: string | null; // ISO date for biweekly calculation
  budgetCycleSemiMonthlyDays: string | null; // JSON "[1, 15]" for semi-monthly
  budgetPeriodRollover: boolean;
  budgetPeriodManualAmount: number | null;
}

export interface BudgetPeriod {
  start: Date;
  end: Date;
  startStr: string; // YYYY-MM-DD
  endStr: string; // YYYY-MM-DD
  periodNumber: number; // 1-based period number within the month
  periodsInMonth: number; // Total periods in the current month
}

export interface AvailableAmountResult {
  currentPeriod: BudgetPeriod;
  periodBudget: number;
  cashBalance: number;
  paidThisPeriod: number;
  autopayDue: number;
  manualBillsDue: number;
  available: number;
  daysRemaining: number;
  rolloverFromPrevious: number;
}

// ============================================================================
// PERIOD CALCULATION FUNCTIONS
// ============================================================================

/**
 * Parse semi-monthly days from JSON string
 * Returns sorted array of day numbers [1, 15] or [5, 20], etc.
 */
export function parseSemiMonthlyDays(jsonStr: string | null): [number, number] {
  if (!jsonStr) {
    return [1, 15]; // Default to 1st and 15th
  }
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length >= 2) {
      const days = parsed.map(Number).filter((d) => d >= 1 && d <= 31);
      if (days.length >= 2) {
        return [Math.min(days[0], days[1]), Math.max(days[0], days[1])] as [number, number];
      }
    }
  } catch {
    // Fall through to default
  }
  return [1, 15];
}

/**
 * Get the current budget period based on settings
 */
export function getCurrentBudgetPeriod(
  settings: BudgetScheduleSettings,
  referenceDate: Date = new Date()
): BudgetPeriod {
  const today = startOfDay(referenceDate);

  switch (settings.budgetCycleFrequency) {
    case 'weekly':
      return getWeeklyPeriod(settings, today);
    case 'biweekly':
      return getBiweeklyPeriod(settings, today);
    case 'semi-monthly':
      return getSemiMonthlyPeriod(settings, today);
    case 'monthly':
    default:
      return getMonthlyPeriod(today);
  }
}

/**
 * Get the next budget period based on settings
 */
export function getNextBudgetPeriod(
  settings: BudgetScheduleSettings,
  referenceDate: Date = new Date()
): BudgetPeriod {
  const currentPeriod = getCurrentBudgetPeriod(settings, referenceDate);
  // Get period starting the day after current period ends
  return getCurrentBudgetPeriod(settings, addDays(currentPeriod.end, 1));
}

/**
 * Get days remaining in current budget period
 */
export function getDaysUntilNextPeriod(
  settings: BudgetScheduleSettings,
  referenceDate: Date = new Date()
): number {
  const currentPeriod = getCurrentBudgetPeriod(settings, referenceDate);
  const today = startOfDay(referenceDate);
  return differenceInDays(currentPeriod.end, today) + 1; // +1 to include today
}

// ============================================================================
// PERIOD TYPE IMPLEMENTATIONS
// ============================================================================

/**
 * Weekly period calculation
 * Period starts on the configured day of week
 */
function getWeeklyPeriod(settings: BudgetScheduleSettings, today: Date): BudgetPeriod {
  const startDayOfWeek = settings.budgetCycleStartDay ?? 0; // Default to Sunday
  const currentDayOfWeek = getDay(today);

  // Find the start of the current week period
  let periodStart: Date;
  if (currentDayOfWeek >= startDayOfWeek) {
    // Period started earlier this week
    periodStart = setDay(today, startDayOfWeek, { weekStartsOn: 0 });
  } else {
    // Period started last week
    periodStart = setDay(addDays(today, -7), startDayOfWeek, { weekStartsOn: 0 });
  }

  const periodEnd = endOfDay(addDays(periodStart, 6));

  // Calculate period number within the month (approximate)
  const monthStart = startOfMonth(today);
  const dayOfMonth = differenceInDays(periodStart, monthStart);
  const periodNumber = Math.floor(dayOfMonth / 7) + 1;

  return {
    start: periodStart,
    end: periodEnd,
    startStr: format(periodStart, 'yyyy-MM-dd'),
    endStr: format(periodEnd, 'yyyy-MM-dd'),
    periodNumber,
    periodsInMonth: 4, // Approximately 4 weeks per month
  };
}

/**
 * Biweekly period calculation
 * Uses reference date to determine which week we're in
 */
function getBiweeklyPeriod(settings: BudgetScheduleSettings, today: Date): BudgetPeriod {
  const startDayOfWeek = settings.budgetCycleStartDay ?? 5; // Default to Friday
  
  // Reference date is a known date when a period started
  // If not set, use a reasonable default (a recent Friday)
  let referenceDate: Date;
  if (settings.budgetCycleReferenceDate) {
    referenceDate = startOfDay(new Date(settings.budgetCycleReferenceDate));
  } else {
    // Find the most recent occurrence of the start day
    referenceDate = setDay(today, startDayOfWeek, { weekStartsOn: 0 });
    if (isAfter(referenceDate, today)) {
      referenceDate = addDays(referenceDate, -7);
    }
  }

  // Calculate how many weeks since the reference date
  const daysSinceReference = differenceInDays(today, referenceDate);
  const weeksSinceReference = Math.floor(daysSinceReference / 7);
  
  // Determine which biweekly period we're in
  // If odd number of weeks, we're in the week before a new period
  const biweeklyPeriodsSinceReference = Math.floor(weeksSinceReference / 2);
  
  // Calculate period start
  const periodStart = addWeeks(referenceDate, biweeklyPeriodsSinceReference * 2);
  const periodEnd = endOfDay(addDays(periodStart, 13)); // 14 days total

  const dayOfMonth = getDate(periodStart);
  const periodNumber = dayOfMonth <= 15 ? 1 : 2;

  return {
    start: periodStart,
    end: periodEnd,
    startStr: format(periodStart, 'yyyy-MM-dd'),
    endStr: format(periodEnd, 'yyyy-MM-dd'),
    periodNumber,
    periodsInMonth: 2,
  };
}

/**
 * Semi-monthly period calculation (e.g., 1st and 15th)
 */
function getSemiMonthlyPeriod(settings: BudgetScheduleSettings, today: Date): BudgetPeriod {
  const [firstDay, secondDay] = parseSemiMonthlyDays(settings.budgetCycleSemiMonthlyDays);
  const dayOfMonth = getDate(today);
  const monthEnd = endOfMonth(today);
  const lastDayOfMonth = getDate(monthEnd);

  let periodStart: Date;
  let periodEnd: Date;
  let periodNumber: number;

  // Clamp the second day to the actual last day of month
  const effectiveSecondDay = Math.min(secondDay, lastDayOfMonth);

  if (dayOfMonth >= firstDay && dayOfMonth < effectiveSecondDay) {
    // First period of the month
    periodStart = setDate(today, firstDay);
    periodEnd = endOfDay(setDate(today, effectiveSecondDay - 1));
    periodNumber = 1;
  } else if (dayOfMonth >= effectiveSecondDay) {
    // Second period of the month
    periodStart = setDate(today, effectiveSecondDay);
    periodEnd = endOfDay(setDate(addMonths(today, 1), firstDay - 1));
    // Handle month boundary - if next month's first day is 1, end on last day of current month
    if (firstDay === 1) {
      periodEnd = endOfDay(monthEnd);
    }
    periodNumber = 2;
  } else {
    // Before the first day - we're in the second period of the previous month
    periodStart = setDate(addMonths(today, -1), effectiveSecondDay);
    periodEnd = endOfDay(setDate(today, firstDay - 1));
    periodNumber = 2;
  }

  return {
    start: startOfDay(periodStart),
    end: periodEnd,
    startStr: format(periodStart, 'yyyy-MM-dd'),
    endStr: format(periodEnd, 'yyyy-MM-dd'),
    periodNumber,
    periodsInMonth: 2,
  };
}

/**
 * Monthly period calculation
 */
function getMonthlyPeriod(today: Date): BudgetPeriod {
  const periodStart = startOfMonth(today);
  const periodEnd = endOfDay(endOfMonth(today));

  return {
    start: periodStart,
    end: periodEnd,
    startStr: format(periodStart, 'yyyy-MM-dd'),
    endStr: format(periodEnd, 'yyyy-MM-dd'),
    periodNumber: 1,
    periodsInMonth: 1,
  };
}

// ============================================================================
// BUDGET AMOUNT CALCULATIONS
// ============================================================================

/**
 * Calculate the budget amount for a single period
 * @param monthlyBudget - Total monthly budget amount
 * @param frequency - Budget cycle frequency
 * @param manualOverride - Optional manual override amount
 */
export function getPeriodBudgetAmount(
  monthlyBudget: number,
  frequency: BudgetCycleFrequency,
  manualOverride?: number | null
): number {
  // If manual override is set, use it
  if (manualOverride !== null && manualOverride !== undefined) {
    return manualOverride;
  }

  // Auto-divide based on frequency
  switch (frequency) {
    case 'weekly':
      // ~4.33 weeks per month
      return new Decimal(monthlyBudget).dividedBy(4.33).toDecimalPlaces(2).toNumber();
    case 'biweekly':
      // 2 biweekly periods per month (approximately)
      return new Decimal(monthlyBudget).dividedBy(2).toDecimalPlaces(2).toNumber();
    case 'semi-monthly':
      // Exactly 2 periods per month
      return new Decimal(monthlyBudget).dividedBy(2).toDecimalPlaces(2).toNumber();
    case 'monthly':
    default:
      return monthlyBudget;
  }
}

/**
 * Get the number of periods per month for a given frequency
 */
export function getPeriodsPerMonth(frequency: BudgetCycleFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 4.33; // Average
    case 'biweekly':
      return 2.17; // Average (26 periods / 12 months)
    case 'semi-monthly':
      return 2;
    case 'monthly':
    default:
      return 1;
  }
}

// ============================================================================
// AVAILABLE AMOUNT CALCULATION
// ============================================================================

/**
 * Calculate the available amount for the current budget period
 * Formula: Cash Balance - Paid This Period - Autopay Due - Manual Bills Due
 */
export function calculateAvailableAmount(
  cashBalance: number,
  paidThisPeriod: number,
  autopayDue: number,
  manualBillsDue: number,
  rolloverFromPrevious: number = 0
): number {
  return new Decimal(cashBalance)
    .plus(rolloverFromPrevious)
    .minus(paidThisPeriod)
    .minus(autopayDue)
    .minus(manualBillsDue)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Check if a date falls within a budget period
 */
export function isDateInPeriod(date: Date | string, period: BudgetPeriod): boolean {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const startOfCheckDate = startOfDay(checkDate);
  
  return (
    (isAfter(startOfCheckDate, period.start) || isSameDay(startOfCheckDate, period.start)) &&
    (isBefore(startOfCheckDate, period.end) || isSameDay(startOfCheckDate, period.end))
  );
}

/**
 * Get a human-readable label for the budget period
 */
export function getPeriodLabel(
  period: BudgetPeriod,
  frequency: BudgetCycleFrequency
): string {
  const startFormatted = format(period.start, 'MMM d');
  const endFormatted = format(period.end, 'MMM d');

  switch (frequency) {
    case 'weekly':
      return `Week of ${startFormatted}`;
    case 'biweekly':
      return `${startFormatted} - ${endFormatted}`;
    case 'semi-monthly':
      if (period.periodNumber === 1) {
        return `First half of ${format(period.start, 'MMMM')}`;
      } else {
        return `Second half of ${format(period.start, 'MMMM')}`;
      }
    case 'monthly':
    default:
      return format(period.start, 'MMMM yyyy');
  }
}

/**
 * Get default settings for budget schedule
 */
export function getDefaultBudgetScheduleSettings(): BudgetScheduleSettings {
  return {
    budgetCycleFrequency: 'monthly',
    budgetCycleStartDay: null,
    budgetCycleReferenceDate: null,
    budgetCycleSemiMonthlyDays: '[1, 15]',
    budgetPeriodRollover: false,
    budgetPeriodManualAmount: null,
  };
}

/**
 * Validate budget schedule settings
 */
export function validateBudgetScheduleSettings(
  settings: Partial<BudgetScheduleSettings>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (settings.budgetCycleFrequency) {
    const validFrequencies: BudgetCycleFrequency[] = ['weekly', 'biweekly', 'semi-monthly', 'monthly'];
    if (!validFrequencies.includes(settings.budgetCycleFrequency)) {
      errors.push(`Invalid budget cycle frequency: ${settings.budgetCycleFrequency}`);
    }
  }

  if (settings.budgetCycleStartDay !== undefined && settings.budgetCycleStartDay !== null) {
    if (settings.budgetCycleStartDay < 0 || settings.budgetCycleStartDay > 6) {
      errors.push('Budget cycle start day must be between 0 (Sunday) and 6 (Saturday)');
    }
  }

  if (settings.budgetCycleSemiMonthlyDays) {
    try {
      const days = JSON.parse(settings.budgetCycleSemiMonthlyDays);
      if (!Array.isArray(days) || days.length !== 2) {
        errors.push('Semi-monthly days must be an array of 2 numbers');
      } else {
        const [day1, day2] = days;
        if (day1 < 1 || day1 > 31 || day2 < 1 || day2 > 31) {
          errors.push('Semi-monthly days must be between 1 and 31');
        }
        if (day1 >= day2) {
          errors.push('First semi-monthly day must be less than second day');
        }
      }
    } catch {
      errors.push('Semi-monthly days must be valid JSON');
    }
  }

  if (settings.budgetPeriodManualAmount !== undefined && settings.budgetPeriodManualAmount !== null) {
    if (settings.budgetPeriodManualAmount < 0) {
      errors.push('Manual budget amount cannot be negative');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

