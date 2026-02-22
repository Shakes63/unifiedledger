import { applyRepeatTransactionRules } from '@/lib/transactions/transaction-repeat-rule-application';
import { validateRepeatRuleMerchant } from '@/lib/transactions/transaction-repeat-template-load';

export async function executeRepeatRulePipeline({
  userId,
  householdId,
  accountName,
  accountId,
  transactionAmount,
  transactionDate,
  transactionType,
  transactionNotes,
  categoryId,
  transactionDescription,
}: {
  userId: string;
  householdId: string;
  accountName: string;
  accountId: string;
  transactionAmount: number;
  transactionDate: string;
  transactionType: string;
  transactionNotes: string | null;
  categoryId: string | null;
  transactionDescription: string;
}) {
  const {
    appliedRuleId,
    appliedActions,
    postCreationMutations,
    finalIsTaxDeductible,
    finalIsSalesTaxable,
    appliedCategoryId,
    finalDescription,
    finalMerchantId: candidateMerchantId,
  } = await applyRepeatTransactionRules({
    userId,
    householdId,
    accountName,
    accountId,
    transactionAmount,
    transactionDate,
    transactionType,
    transactionNotes,
    appliedCategoryId: categoryId,
    finalDescription: transactionDescription,
    finalMerchantId: null,
  });

  const finalMerchantId = await validateRepeatRuleMerchant({
    userId,
    householdId,
    finalMerchantId: candidateMerchantId,
  });

  return {
    appliedRuleId,
    appliedActions,
    postCreationMutations,
    finalIsTaxDeductible,
    finalIsSalesTaxable,
    appliedCategoryId,
    finalDescription,
    finalMerchantId,
  };
}
