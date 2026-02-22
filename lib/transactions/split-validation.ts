import {
  DEFAULT_SPLIT_TOLERANCE,
  type BatchSplitItem,
  type SplitEntry,
  type SplitValidationOptions,
  type SplitValidationResult,
} from '@/lib/transactions/split-types';
import {
  sumSplitAmounts,
  validateAmountTotal,
  validatePercentageTotal,
  validateSplitMixing,
} from '@/lib/transactions/split-validation-core';
import {
  toBatchSplitEntries,
  validateSplitStructure,
} from '@/lib/transactions/split-validation-helpers';

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
