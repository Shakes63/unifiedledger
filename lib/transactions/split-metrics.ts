import Decimal from 'decimal.js';

import type { SplitEntry } from '@/lib/transactions/split-types';

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
