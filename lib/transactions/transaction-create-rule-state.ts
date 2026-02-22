import type { TransactionMutations } from '@/lib/rules/types';

export interface CreateRuleApplicationState {
  appliedActions: unknown[];
  appliedCategoryId: string | null;
  appliedRuleId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
  postCreationMutations: TransactionMutations | null;
}

export function createRuleApplicationState({
  appliedCategoryId,
  finalDescription,
  finalMerchantId,
}: {
  appliedCategoryId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
}): CreateRuleApplicationState {
  return {
    appliedActions: [],
    appliedCategoryId,
    appliedRuleId: null,
    finalDescription,
    finalMerchantId,
    postCreationMutations: null,
  };
}
