import {
  DEFAULT_SPLIT_TOLERANCE,
  type BatchSplitItem,
  type SplitEntry,
  type SplitValidationOptions,
} from '@/lib/transactions/split-types';
import {
  sumSplitPercentages,
  validateConfiguredAmountTotal,
  validateSplitItemRules,
  validateSplitMixing,
} from '@/lib/transactions/split-validation-core';

export function validateSplitStructure(
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

export function toBatchSplitEntries(splits: BatchSplitItem[]): SplitEntry[] {
  return splits.map((split) => ({
    amount: split.amount,
    percentage: split.percentage,
    isPercentage: split.isPercentage,
    categoryId: split.categoryId,
  }));
}
