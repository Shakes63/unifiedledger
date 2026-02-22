import type { TransactionMutations } from '@/lib/rules/types';
import { applyCreateTransactionRules } from '@/lib/transactions/transaction-create-rule-application';

export async function executeCreateRuleApplication({
  userId,
  householdId,
  accountId,
  accountName,
  merchantId,
  categoryId,
  amount,
  date,
  notes,
  type,
  description,
}: {
  userId: string;
  householdId: string;
  accountId: string;
  accountName: string;
  merchantId?: string | null;
  categoryId?: string | null;
  amount: string;
  date: string;
  notes?: string;
  type: string;
  description: string;
}): Promise<{
  appliedCategoryId: string | null;
  appliedRuleId: string | null;
  appliedActions: unknown[];
  finalDescription: string;
  finalMerchantId: string | null;
  postCreationMutations: TransactionMutations | null;
}> {
  let appliedCategoryId = categoryId ?? null;
  let appliedRuleId: string | null = null;
  let appliedActions: unknown[] = [];
  let finalDescription = description;
  let finalMerchantId = merchantId ?? null;
  let postCreationMutations: TransactionMutations | null = null;

  ({
    appliedCategoryId,
    finalDescription,
    finalMerchantId,
    appliedRuleId,
    appliedActions,
    postCreationMutations,
  } = await applyCreateTransactionRules({
    userId,
    householdId,
    accountId,
    accountName,
    merchantId,
    categoryId,
    amount,
    date,
    notes,
    type,
    description,
    appliedCategoryId,
    finalDescription,
    finalMerchantId,
  }));

  return {
    appliedCategoryId,
    appliedRuleId,
    appliedActions,
    finalDescription,
    finalMerchantId,
    postCreationMutations,
  };
}
