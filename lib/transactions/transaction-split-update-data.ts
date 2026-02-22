import {
  amountToCents,
  buildTransactionAmountFields,
} from '@/lib/transactions/money-movement-service';
import {
  calculateSplitAmount,
  type SplitUpdateData,
} from '@/lib/transactions/transaction-split-route-shared';

export function buildSplitUpdateData({
  amount,
  categoryId,
  description,
  isPercentage,
  notes,
  percentage,
  sortOrder,
  transactionAmount,
}: {
  amount: number | undefined;
  categoryId: string | undefined;
  description: string | null | undefined;
  isPercentage: boolean | undefined;
  notes: string | null | undefined;
  percentage: number | undefined;
  sortOrder: number | undefined;
  transactionAmount: number;
}): SplitUpdateData {
  const updateData: SplitUpdateData = {
    updatedAt: new Date().toISOString(),
  };

  if (categoryId) {
    updateData.categoryId = categoryId;
  }

  if (isPercentage !== undefined) {
    updateData.isPercentage = isPercentage;
    const finalAmount = calculateSplitAmount(transactionAmount, amount, isPercentage, percentage);
    updateData.percentage = isPercentage ? (percentage ?? 0) : 0;
    Object.assign(updateData, buildTransactionAmountFields(amountToCents(finalAmount)));
  } else {
    if (amount !== undefined) {
      Object.assign(updateData, buildTransactionAmountFields(amountToCents(amount)));
    }
    if (percentage !== undefined) {
      updateData.percentage = percentage;
    }
  }

  if (description !== undefined) {
    updateData.description = description;
  }
  if (notes !== undefined) {
    updateData.notes = notes;
  }
  if (sortOrder !== undefined) {
    updateData.sortOrder = sortOrder;
  }

  return updateData;
}
