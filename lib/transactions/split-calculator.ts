/**
 * Split math + validation: penny-exact allocation across splits, batch
 * validation for the splits API, and the metrics the split builder UI shows.
 *
 * Consolidated from 6 shim files (types / validation-core / validation-helpers
 * / validation / metrics / barrel) during the post-audit cleanup; behavior is
 * unchanged. The module name stays split-calculator because four external
 * callers import it.
 */
import Decimal from 'decimal.js';

// ---------------------------------------------------------------------------
// from split-types.ts
// ---------------------------------------------------------------------------
export interface SplitEntry {
  amount?: number;
  percentage?: number;
  isPercentage: boolean;
  categoryId?: string;
}

export interface SplitValidationResult {
  valid: boolean;
  errors: string[];
  totalAmount?: number;
  totalPercentage?: number;
}

export interface SplitValidationOptions {
  requireCategory?: boolean;
  requirePositiveValues?: boolean;
  tolerance?: number;
  transactionAmount?: number;
}

export interface BatchSplitItem {
  id?: string;
  categoryId: string;
  amount?: number;
  percentage?: number;
  isPercentage: boolean;
  description?: string;
  notes?: string;
  sortOrder?: number;
}

const DEFAULT_SPLIT_TOLERANCE = 0.01;

// ---------------------------------------------------------------------------
// from split-validation-core.ts
// ---------------------------------------------------------------------------
function hasMixedSplitTypes(splits: SplitEntry[]): boolean {
  const hasPercentage = splits.some((s) => s.isPercentage);
  const hasAmount = splits.some((s) => !s.isPercentage);
  return hasPercentage && hasAmount;
}

function sumSplitPercentages(splits: SplitEntry[]): number {
  return splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
}

function sumSplitAmounts(splits: SplitEntry[]): Decimal {
  return splits.reduce((sum, s) => sum.plus(new Decimal(s.amount || 0)), new Decimal(0));
}

function validateSplitMixing(splits: SplitEntry[]): string | null {
  if (hasMixedSplitTypes(splits)) {
    return 'Cannot mix percentage and amount splits';
  }
  return null;
}

function validatePercentageTotal({
  splits,
  tolerance = DEFAULT_SPLIT_TOLERANCE,
}: {
  splits: SplitEntry[];
  tolerance?: number;
}): { totalPercentage: number; error: string | null } {
  const totalPercentage = sumSplitPercentages(splits);
  if (Math.abs(totalPercentage - 100) > tolerance) {
    return {
      totalPercentage,
      error: `Percentage splits must sum to 100% (current: ${totalPercentage.toFixed(2)}%)`,
    };
  }
  return { totalPercentage, error: null };
}

function validateAmountTotal({
  splits,
  transactionAmount,
  tolerance = DEFAULT_SPLIT_TOLERANCE,
}: {
  splits: SplitEntry[];
  transactionAmount: number;
  tolerance?: number;
}): { totalAmount: number; error: string | null } {
  const sumAmount = sumSplitAmounts(splits);
  const expectedAmount = new Decimal(transactionAmount);
  if (Math.abs(sumAmount.minus(expectedAmount).toNumber()) > tolerance) {
    return {
      totalAmount: sumAmount.toNumber(),
      error: `Amount splits must sum to $${transactionAmount.toFixed(2)} (current: $${sumAmount.toFixed(2)})`,
    };
  }
  return { totalAmount: sumAmount.toNumber(), error: null };
}

function validateSplitItemRules({
  split,
  index,
  requireCategory,
  requirePositiveValues,
}: {
  split: SplitEntry;
  index: number;
  requireCategory: boolean;
  requirePositiveValues: boolean;
}): string | null {
  if (requireCategory && !split.categoryId) {
    return `Split #${index + 1}: Category is required`;
  }

  if (split.isPercentage) {
    const pct = split.percentage ?? 0;
    if (requirePositiveValues && pct <= 0) {
      return `Split #${index + 1}: Percentage must be greater than 0`;
    }
    if (pct > 100) {
      return `Split #${index + 1}: Percentage cannot exceed 100`;
    }
    return null;
  }

  const amt = split.amount ?? 0;
  if (requirePositiveValues && amt <= 0) {
    return `Split #${index + 1}: Amount must be greater than 0`;
  }
  return null;
}

function validateConfiguredAmountTotal({
  splits,
  transactionAmount,
  tolerance,
}: {
  splits: SplitEntry[];
  transactionAmount: number;
  tolerance: number;
}): string | null {
  const sumAmount = sumSplitAmounts(splits);
  const expectedAmount = new Decimal(transactionAmount);
  if (sumAmount.greaterThan(expectedAmount.plus(tolerance))) {
    return `Split total ($${sumAmount.toFixed(2)}) exceeds transaction amount ($${expectedAmount.toFixed(2)})`;
  }
  if (Math.abs(sumAmount.minus(expectedAmount).toNumber()) > tolerance) {
    return `Amount splits must sum to $${transactionAmount.toFixed(2)} (current: $${sumAmount.toFixed(2)})`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// from split-validation-helpers.ts
// ---------------------------------------------------------------------------
function validateSplitStructure(
  splits: SplitEntry[],
  options: SplitValidationOptions = {}
): string | null {
  const {
    requireCategory = false,
    requirePositiveValues = false,
    tolerance = DEFAULT_SPLIT_TOLERANCE,
    transactionAmount,
  } = options;

  if (!splits || splits.length === 0) {
    return 'At least one split is required';
  }

  for (let i = 0; i < splits.length; i++) {
    const validationError = validateSplitItemRules({
      split: splits[i],
      index: i,
      requireCategory,
      requirePositiveValues,
    });
    if (validationError) {
      return validationError;
    }
  }

  const hasPercentage = splits.some((split) => split.isPercentage);
  const mixingError = validateSplitMixing(splits);
  if (mixingError) {
    return mixingError;
  }

  if (hasPercentage) {
    const totalPercentage = sumSplitPercentages(splits);
    if (totalPercentage > 100 + tolerance) {
      return `Total percentage (${totalPercentage.toFixed(2)}%) exceeds 100%`;
    }
    if (Math.abs(totalPercentage - 100) > tolerance) {
      return `Percentage splits must sum to 100% (current: ${totalPercentage.toFixed(2)}%)`;
    }
    return null;
  }

  if (transactionAmount !== undefined) {
    const configuredAmountError = validateConfiguredAmountTotal({
      splits,
      transactionAmount,
      tolerance,
    });
    if (configuredAmountError) {
      return configuredAmountError;
    }
  }

  return null;
}

function toBatchSplitEntries(splits: BatchSplitItem[]): SplitEntry[] {
  return splits.map((split) => ({
    amount: split.amount,
    percentage: split.percentage,
    isPercentage: split.isPercentage,
    categoryId: split.categoryId,
  }));
}

// ---------------------------------------------------------------------------
// from split-validation.ts
// ---------------------------------------------------------------------------
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

  const hasPercentage = splits.some((s) => s.isPercentage);
  const mixingError = validateSplitMixing(splits);
  if (mixingError) {
    errors.push(mixingError);
    return { valid: false, errors };
  }

  if (hasPercentage) {
    const { totalPercentage, error } = validatePercentageTotal({
      splits,
      tolerance: DEFAULT_SPLIT_TOLERANCE,
    });
    if (error) {
      errors.push(error);
    }

    return {
      valid: errors.length === 0,
      errors,
      totalPercentage,
    };
  }

  const sumAmount = sumSplitAmounts(splits);
  const { error } = validateAmountTotal({
    splits,
    transactionAmount,
    tolerance: DEFAULT_SPLIT_TOLERANCE,
  });
  if (error) {
    errors.push(error);
  }

  return {
    valid: errors.length === 0,
    errors,
    totalAmount: sumAmount.toNumber(),
  };
}

export function validateSplitConfiguration(
  splits: SplitEntry[],
  options: SplitValidationOptions = {}
): string | null {
  return validateSplitStructure(splits, options);
}

export function validateBatchSplits(
  splits: BatchSplitItem[],
  transactionAmount: number
): { valid: boolean; error: string | null } {
  const splitEntries = toBatchSplitEntries(splits);

  const validationError = validateSplitConfiguration(splitEntries, {
    requireCategory: true,
    requirePositiveValues: false,
    tolerance: DEFAULT_SPLIT_TOLERANCE,
    transactionAmount,
  });

  return {
    valid: validationError === null,
    error: validationError,
  };
}

// ---------------------------------------------------------------------------
// from split-metrics.ts
// ---------------------------------------------------------------------------
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
    const calculatedAmount = transactionDecimal
      .times(percentage)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      id: index,
      amount: calculatedAmount.toNumber(),
    };
  });
}

export function getRemainingForNewSplit(
  splits: SplitEntry[],
  transactionAmount: number,
  isPercentage: boolean
): number {
  if (isPercentage) {
    const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
    return Math.max(0, 100 - totalPercentage);
  }

  const totalAmount = splits.reduce(
    (sum, s) => new Decimal(sum).plus(new Decimal(s.amount || 0)),
    new Decimal(0)
  );

  const remaining = new Decimal(transactionAmount).minus(totalAmount);
  return Math.max(0, remaining.toNumber());
}

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
  }

  const amount = split.amount || 0;
  const percentage = new Decimal(amount)
    .dividedBy(new Decimal(transactionAmount))
    .times(100)
    .toNumber();

  return { percentage, amount };
}
