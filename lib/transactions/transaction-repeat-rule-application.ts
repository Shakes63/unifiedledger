import { findMatchingRule } from '@/lib/rules/rule-matcher';
import { TransactionData } from '@/lib/rules/condition-evaluator';
import { executeRuleActions } from '@/lib/rules/actions-executor';
import type { TransactionMutations } from '@/lib/rules/types';

export async function applyRepeatTransactionRules({
  userId,
  householdId,
  accountName,
  accountId,
  transactionAmount,
  transactionDate,
  transactionType,
  transactionNotes,
  appliedCategoryId,
  finalDescription,
  finalMerchantId,
}: {
  userId: string;
  householdId: string;
  accountName: string;
  accountId: string;
  transactionAmount: string | number;
  transactionDate: string;
  transactionType: string;
  transactionNotes: string | null;
  appliedCategoryId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
}): Promise<{
  appliedCategoryId: string | null;
  appliedRuleId: string | null;
  appliedActions: unknown[];
  finalDescription: string;
  finalMerchantId: string | null;
  postCreationMutations: TransactionMutations | null;
  finalIsTaxDeductible: boolean;
  finalIsSalesTaxable: boolean;
}> {
  let appliedRuleId: string | null = null;
  let appliedActions: unknown[] = [];
  let postCreationMutations: TransactionMutations | null = null;
  let finalIsTaxDeductible = false;
  let finalIsSalesTaxable = false;

  if (appliedCategoryId || transactionType === 'transfer_in' || transactionType === 'transfer_out') {
    return {
      appliedCategoryId,
      appliedRuleId,
      appliedActions,
      finalDescription,
      finalMerchantId,
      postCreationMutations,
      finalIsTaxDeductible,
      finalIsSalesTaxable,
    };
  }

  try {
    const transactionData: TransactionData = {
      description: finalDescription,
      amount: parseFloat(transactionAmount.toString()),
      accountName,
      date: transactionDate,
      notes: transactionNotes || undefined,
    };

    const ruleMatch = await findMatchingRule(userId, householdId, transactionData);

    if (ruleMatch.matched && ruleMatch.rule) {
      appliedRuleId = ruleMatch.rule.ruleId;

      const executionResult = await executeRuleActions(
        userId,
        ruleMatch.rule.actions,
        {
          categoryId: appliedCategoryId || null,
          description: finalDescription,
          merchantId: finalMerchantId,
          accountId,
          amount: parseFloat(transactionAmount.toString()),
          date: transactionDate,
          type: transactionType,
          isTaxDeductible: false,
        },
        null,
        null,
        householdId
      );

      if (executionResult.mutations.categoryId !== undefined) {
        appliedCategoryId = executionResult.mutations.categoryId;
      }
      if (executionResult.mutations.description) {
        finalDescription = executionResult.mutations.description;
      }
      if (executionResult.mutations.merchantId !== undefined) {
        finalMerchantId = executionResult.mutations.merchantId;
      }
      if (executionResult.mutations.isTaxDeductible !== undefined) {
        finalIsTaxDeductible = executionResult.mutations.isTaxDeductible;
      }
      if (executionResult.mutations.isSalesTaxable !== undefined) {
        finalIsSalesTaxable = executionResult.mutations.isSalesTaxable;
      }

      appliedActions = executionResult.appliedActions;
      postCreationMutations = executionResult.mutations;

      if (executionResult.errors && executionResult.errors.length > 0) {
        console.warn('Rule action execution errors:', executionResult.errors);
      }
    }
  } catch (error) {
    console.error('Error applying categorization rules:', error);
  }

  return {
    appliedCategoryId,
    appliedRuleId,
    appliedActions,
    finalDescription,
    finalMerchantId,
    postCreationMutations,
    finalIsTaxDeductible,
    finalIsSalesTaxable,
  };
}
