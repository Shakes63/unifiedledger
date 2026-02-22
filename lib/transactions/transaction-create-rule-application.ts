import { executeRuleActions } from '@/lib/rules/actions-executor';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import type { TransactionMutations } from '@/lib/rules/types';
import {
  createRuleApplicationState,
} from '@/lib/transactions/transaction-create-rule-state';
import {
  buildRuleTransactionData,
  loadRuleReferenceData,
  mergeRuleMutations,
  shouldSkipCreateRuleApplication,
} from '@/lib/transactions/transaction-create-rule-helpers';

interface ApplyCreateTransactionRulesParams {
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
  appliedCategoryId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
}

interface ApplyCreateTransactionRulesResult {
  appliedCategoryId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
  appliedRuleId: string | null;
  appliedActions: unknown[];
  postCreationMutations: TransactionMutations | null;
}

export async function applyCreateTransactionRules({
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
}: ApplyCreateTransactionRulesParams): Promise<ApplyCreateTransactionRulesResult> {
  const state = createRuleApplicationState({
    appliedCategoryId,
    finalDescription,
    finalMerchantId,
  });

  if (shouldSkipCreateRuleApplication({ appliedCategoryId, type })) {
    return {
      ...state,
    };
  }

  try {
    const transactionData = buildRuleTransactionData({
      description,
      amount,
      accountName,
      date,
      notes,
    });

    const ruleMatch = await findMatchingRule(userId, householdId, transactionData);
    if (!ruleMatch.matched || !ruleMatch.rule) {
      return {
        ...state,
      };
    }

    state.appliedRuleId = ruleMatch.rule.ruleId;

    const { merchantInfo, categoryInfo } = await loadRuleReferenceData({
      userId,
      householdId,
      merchantId,
      categoryId,
    });

    const executionResult = await executeRuleActions(
      userId,
      ruleMatch.rule.actions,
      {
        categoryId: appliedCategoryId || null,
        description,
        merchantId: merchantId || null,
        accountId,
        amount: parseFloat(amount),
        date,
        type,
        isTaxDeductible: false,
      },
      merchantInfo,
      categoryInfo,
      householdId
    );

    ({
      appliedCategoryId: state.appliedCategoryId,
      finalDescription: state.finalDescription,
      finalMerchantId: state.finalMerchantId,
    } = mergeRuleMutations({
      appliedCategoryId: state.appliedCategoryId,
      finalDescription: state.finalDescription,
      finalMerchantId: state.finalMerchantId,
      mutations: executionResult.mutations,
    }));

    state.appliedActions = executionResult.appliedActions;
    state.postCreationMutations = executionResult.mutations;

    if (executionResult.errors && executionResult.errors.length > 0) {
      console.warn('Rule action execution errors:', executionResult.errors);
    }
  } catch (error) {
    console.error('Error applying categorization rules:', error);
  }

  return {
    ...state,
  };
}
