import Decimal from 'decimal.js';

import { DEFAULT_SPLIT_TOLERANCE, type SplitEntry } from '@/lib/transactions/split-types';

export function hasMixedSplitTypes(splits: SplitEntry[]): boolean {
  const hasPercentage = splits.some((s) => s.isPercentage);
  const hasAmount = splits.some((s) => !s.isPercentage);
  return hasPercentage && hasAmount;
}

export function sumSplitPercentages(splits: SplitEntry[]): number {
  return splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
}

export function sumSplitAmounts(splits: SplitEntry[]): Decimal {
  return splits.reduce((sum, s) => sum.plus(new Decimal(s.amount || 0)), new Decimal(0));
}

export function validateSplitMixing(splits: SplitEntry[]): string | null {
  if (hasMixedSplitTypes(splits)) {
    return 'Cannot mix percentage and amount splits';
  }
  return null;
}

export function validatePercentageTotal({
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

export function validateAmountTotal({
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

export function validateSplitItemRules({
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

export function validateConfiguredAmountTotal({
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
