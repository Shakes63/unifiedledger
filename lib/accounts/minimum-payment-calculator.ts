/**
 * Minimum Payment Calculator
 *
 * Calculates credit card minimum payment based on:
 * - Current balance
 * - Minimum payment percentage
 * - Minimum payment floor (absolute minimum)
 */

import Decimal from 'decimal.js';

export interface MinimumPaymentParams {
  currentBalance: number;
  minimumPaymentPercent: number | null;
  minimumPaymentFloor: number | null;
}

export interface MinimumPaymentResult {
  minimumPaymentAmount: number;
  calculationMethod: 'floor' | 'percent' | 'zero';
}

/**
 * Calculate the minimum payment amount for a credit card
 *
 * Formula: MAX(minimumPaymentFloor, currentBalance * minimumPaymentPercent / 100)
 *
 * Edge cases:
 * - If balance is 0 or negative (credit on account), return 0
 * - If no percentage/floor set, return 0
 * - Always returns at least the floor if there's a balance
 * - Never exceeds the balance (can't pay more than owed)
 *
 * @param params - The minimum payment calculation parameters
 * @returns The calculated minimum payment amount and method used
 */
export function calculateMinimumPayment({
  currentBalance,
  minimumPaymentPercent,
  minimumPaymentFloor,
}: MinimumPaymentParams): MinimumPaymentResult {
  // No balance means no minimum payment
  // Credit cards store balance as positive number representing debt owed
  const balance = Math.abs(currentBalance);
  if (balance <= 0) {
    return {
      minimumPaymentAmount: 0,
      calculationMethod: 'zero',
    };
  }

  // If neither setting is configured, return 0
  if (!minimumPaymentPercent && !minimumPaymentFloor) {
    return {
      minimumPaymentAmount: 0,
      calculationMethod: 'zero',
    };
  }

  // Calculate percentage-based minimum (default to 0 if not set)
  const percentAmount = minimumPaymentPercent
    ? new Decimal(balance).times(minimumPaymentPercent).dividedBy(100)
    : new Decimal(0);

  // Get floor amount (default to 0 if not set)
  const floorAmount = new Decimal(minimumPaymentFloor || 0);

  // Take the maximum of floor and calculated percentage
  const calculatedMinimum = Decimal.max(floorAmount, percentAmount);

  // Don't exceed the balance (can't pay more than what's owed)
  const finalAmount = Decimal.min(calculatedMinimum, new Decimal(balance));

  // Determine which method was used (for reporting/debugging)
  const calculationMethod: 'floor' | 'percent' =
    floorAmount.greaterThan(percentAmount) ? 'floor' : 'percent';

  return {
    minimumPaymentAmount: finalAmount.toDecimalPlaces(2).toNumber(),
    calculationMethod,
  };
}
