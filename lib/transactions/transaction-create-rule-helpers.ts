import type { TransactionMutations } from '@/lib/rules/types';
import { loadRuleReferenceData } from '@/lib/transactions/transaction-create-rule-reference-load';

export function shouldSkipCreateRuleApplication({
  appliedCategoryId,
  type,
}: {
  appliedCategoryId: string | null;
  type: string;
}): boolean {
  return (
    Boolean(appliedCategoryId) ||
    type === 'transfer_in' ||
    type === 'transfer_out' ||
    type === 'transfer'
  );
}

export function buildRuleTransactionData({
  description,
  amount,
  accountName,
  date,
  notes,
}: {
  description: string;
  amount: string;
  accountName: string;
  date: string;
  notes?: string;
}): {
  description: string;
  amount: number;
  accountName: string;
  date: string;
  notes?: string;
} {
  return {
    description,
    amount: parseFloat(amount),
    accountName,
    date,
    notes: notes || undefined,
  };
}

export { loadRuleReferenceData };

export function mergeRuleMutations({
  appliedCategoryId,
  finalDescription,
  finalMerchantId,
  mutations,
}: {
  appliedCategoryId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
  mutations: TransactionMutations;
}): {
  appliedCategoryId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
} {
  let nextCategoryId = appliedCategoryId;
  let nextDescription = finalDescription;
  let nextMerchantId = finalMerchantId;

  if (mutations.categoryId !== undefined) {
    nextCategoryId = mutations.categoryId;
  }
  if (mutations.description) {
    nextDescription = mutations.description;
  }
  if (mutations.merchantId !== undefined) {
    nextMerchantId = mutations.merchantId;
  }

  return {
    appliedCategoryId: nextCategoryId,
    finalDescription: nextDescription,
    finalMerchantId: nextMerchantId,
  };
}
