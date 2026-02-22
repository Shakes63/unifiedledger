import Decimal from 'decimal.js';
import type { TransactionMutations } from '@/lib/rules/types';
import {
  updateRepeatCategoryUsage,
  updateRepeatTemplateUsage,
} from '@/lib/transactions/transaction-repeat-usage-updates';
import { updateRepeatMerchantUsage } from '@/lib/transactions/transaction-repeat-merchant-updates';
import {
  logRepeatRuleExecution,
  runRepeatPostCreationActions,
} from '@/lib/transactions/transaction-repeat-post-actions';

export async function finalizeRepeatTransactionPostProcessing({
  userId,
  householdId,
  templateId,
  tmplUsageCount,
  appliedCategoryId,
  finalMerchantId,
  finalDescription,
  decimalAmount,
  transactionId,
  appliedRuleId,
  appliedActions,
  postCreationMutations,
}: {
  userId: string;
  householdId: string;
  templateId: string;
  tmplUsageCount: number | null;
  appliedCategoryId: string | null;
  finalMerchantId: string | null;
  finalDescription: string;
  decimalAmount: Decimal;
  transactionId: string;
  appliedRuleId: string | null;
  appliedActions: unknown[];
  postCreationMutations: TransactionMutations | null;
}): Promise<void> {
  await updateRepeatTemplateUsage({
    templateId,
    tmplUsageCount,
  });

  await updateRepeatCategoryUsage({
    userId,
    householdId,
    appliedCategoryId,
  });

  await updateRepeatMerchantUsage({
    userId,
    householdId,
    finalMerchantId,
    finalDescription,
    appliedCategoryId,
    decimalAmount,
  });

  await logRepeatRuleExecution({
    userId,
    householdId,
    appliedRuleId,
    transactionId,
    appliedCategoryId,
    appliedActions,
  });

  await runRepeatPostCreationActions({
    userId,
    transactionId,
    postCreationMutations,
  });
}
