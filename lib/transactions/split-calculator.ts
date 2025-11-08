import Decimal from 'decimal.js';

export interface SplitEntry {
  amount?: number;
  percentage?: number;
  isPercentage: boolean;
}

export interface SplitValidationResult {
  valid: boolean;
  errors: string[];
  totalAmount?: number;
  totalPercentage?: number;
}

/**
 * Validate splits to ensure they sum correctly
 * - Percentage splits should sum to 100 (with small tolerance)
 * - Amount splits should sum to the transaction total
 * - Mixed splits are not allowed
 */
export function validateSplits(
  splits: SplitEntry[],
  transactionAmount: number
): SplitValidationResult {
  const errors: string[] = [];

  if (splits.length === 0) {
    return {
      valid: false,
      errors: ['At least one split is required'],
    };
  }

  // Check for mixed split types
  const hasPercentage = splits.some((s) => s.isPercentage);
  const hasAmount = splits.some((s) => !s.isPercentage);

  if (hasPercentage && hasAmount) {
    errors.push('Cannot mix percentage and amount splits');
    return { valid: false, errors };
  }

  if (hasPercentage) {
    // Validate percentage splits
    const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
    const percentageDifference = Math.abs(totalPercentage - 100);

    if (percentageDifference > 0.01) {
      // Allow 0.01% tolerance for floating point
      errors.push(
        `Percentage splits must sum to 100% (current: ${totalPercentage.toFixed(2)}%)`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      totalPercentage,
    };
  } else {
    // Validate amount splits
    const totalAmount = new Decimal(0);
    const sumAmount = splits.reduce((sum, s) => {
      return sum.plus(new Decimal(s.amount || 0));
    }, totalAmount);

    const expectedAmount = new Decimal(transactionAmount);
    const amountDifference = Math.abs(sumAmount.minus(expectedAmount).toNumber());

    if (amountDifference > 0.01) {
      // Allow $0.01 tolerance for floating point
      errors.push(
        `Amount splits must sum to $${transactionAmount.toFixed(2)} (current: $${sumAmount.toFixed(2)})`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      totalAmount: sumAmount.toNumber(),
    };
  }
}

/**
 * Calculate actual amounts for percentage-based splits
 */
export function calculateSplitAmounts(
  splits: SplitEntry[],
  transactionAmount: number
): { id?: number; amount: number }[] {
  const transactionDecimal = new Decimal(transactionAmount);

  return splits.map((split, index) => {
    if (!split.isPercentage) {
      return {
        id: index,
        amount: split.amount || 0,
      };
    }

    const percentage = new Decimal(split.percentage || 0).dividedBy(100);
    const calculatedAmount = transactionDecimal.times(percentage);

    return {
      id: index,
      amount: calculatedAmount.toNumber(),
    };
  });
}

/**
 * Get the remaining amount/percentage for a new split
 */
export function getRemainingForNewSplit(
  splits: SplitEntry[],
  transactionAmount: number,
  isPercentage: boolean
): number {
  if (isPercentage) {
    const totalPercentage = splits.reduce((sum, s) => {
      return sum + (s.percentage || 0);
    }, 0);
    return Math.max(0, 100 - totalPercentage);
  } else {
    const totalAmount = splits.reduce((sum, s) => {
      return new Decimal(sum).plus(new Decimal(s.amount || 0));
    }, new Decimal(0));

    const remaining = new Decimal(transactionAmount).minus(totalAmount);
    return Math.max(0, remaining.toNumber());
  }
}

/**
 * Calculate what percentage or amount a split represents
 */
export function calculateSplitMetrics(
  split: SplitEntry,
  transactionAmount: number
): { percentage: number; amount: number } {
  if (split.isPercentage) {
    const percentage = split.percentage || 0;
    const amount = new Decimal(transactionAmount)
      .times(new Decimal(percentage).dividedBy(100))
      .toNumber();

    return { percentage, amount };
  } else {
    const amount = split.amount || 0;
    const percentage = new Decimal(amount)
      .dividedBy(new Decimal(transactionAmount))
      .times(100)
      .toNumber();

    return { percentage, amount };
  }
}
