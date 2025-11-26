import Decimal from 'decimal.js';

/**
 * Result of recommended monthly savings calculation
 */
export interface RecommendedSavingsResult {
  /** The recommended monthly contribution, or null if not calculable */
  recommendedMonthly: number | null;
  /** Number of months remaining until target date */
  monthsRemaining: number | null;
  /** Whether the goal is achievable with the recommended amount */
  isAchievable: boolean;
  /** Amount still needed to reach the goal */
  amountRemaining: number;
  /** Human-readable message explaining the recommendation */
  message: string | null;
  /** Whether this is a tight timeline (less than 2 months) */
  isTightTimeline: boolean;
}

/**
 * Calculate the recommended monthly savings contribution for a savings goal.
 * 
 * Formula: (Target Amount - Current Amount) / Months Remaining
 * 
 * Uses Decimal.js for precise financial calculations.
 * 
 * @param targetAmount - The goal's target amount
 * @param currentAmount - The current saved amount
 * @param targetDate - ISO date string for when the goal should be achieved
 * @returns RecommendedSavingsResult with recommendation or explanation message
 */
export function calculateRecommendedMonthlySavings(
  targetAmount: number,
  currentAmount: number,
  targetDate: string | null | undefined
): RecommendedSavingsResult {
  // Convert to Decimal for precision
  const target = new Decimal(targetAmount || 0);
  const current = new Decimal(currentAmount || 0);
  const remaining = target.minus(current);
  const amountRemaining = Math.max(0, remaining.toNumber());

  // Check if goal is already achieved
  if (remaining.lessThanOrEqualTo(0)) {
    return {
      recommendedMonthly: null,
      monthsRemaining: null,
      isAchievable: true,
      amountRemaining: 0,
      message: 'Goal achieved!',
      isTightTimeline: false,
    };
  }

  // Check if no target date is set
  if (!targetDate) {
    return {
      recommendedMonthly: null,
      monthsRemaining: null,
      isAchievable: true,
      amountRemaining,
      message: 'Set a target date to see recommended monthly savings',
      isTightTimeline: false,
    };
  }

  // Calculate months remaining
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const target_date = new Date(targetDate);
  target_date.setHours(0, 0, 0, 0);
  
  // Check if target date is in the past
  if (target_date <= today) {
    return {
      recommendedMonthly: null,
      monthsRemaining: 0,
      isAchievable: false,
      amountRemaining,
      message: 'Target date has passed',
      isTightTimeline: false,
    };
  }

  // Calculate months remaining as fractional value
  // Using average days per month (30.44) for more accurate calculation
  const daysRemaining = Math.ceil((target_date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const monthsRemaining = new Decimal(daysRemaining).div(30.44);
  const monthsRemainingNum = monthsRemaining.toNumber();

  // If less than 1 month, show as one-time contribution
  if (monthsRemaining.lessThan(1)) {
    return {
      recommendedMonthly: amountRemaining,
      monthsRemaining: monthsRemainingNum,
      isAchievable: true,
      amountRemaining,
      message: `${daysRemaining} days remaining - save this amount now to reach your goal`,
      isTightTimeline: true,
    };
  }

  // Calculate recommended monthly
  // Round up to ensure goal is met by target date
  const recommendedMonthly = remaining.div(monthsRemaining).toDecimalPlaces(2, Decimal.ROUND_UP);
  const recommendedMonthlyNum = recommendedMonthly.toNumber();

  // Determine if this is a tight timeline (less than 2 months)
  const isTightTimeline = monthsRemaining.lessThan(2);

  // Format months for message
  const monthsDisplay = monthsRemaining.toDecimalPlaces(1).toNumber();
  const monthText = monthsDisplay === 1 ? 'month' : 'months';

  return {
    recommendedMonthly: recommendedMonthlyNum,
    monthsRemaining: monthsRemainingNum,
    isAchievable: true,
    amountRemaining,
    message: `${monthsDisplay} ${monthText} remaining to reach your goal`,
    isTightTimeline,
  };
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

