import Decimal from 'decimal.js';
import { logCreateRuleExecution } from '@/lib/transactions/transaction-create-rule-log';
import { updateCreateCategoryAndMerchantUsage } from '@/lib/transactions/transaction-create-metadata-usage';

interface RunTransactionCreateMetadataUpdatesParams {
  userId: string;
  householdId: string;
  transactionId: string;
  categoryId?: string | null;
  finalMerchantId?: string | null;
  decimalAmount: Decimal;
  appliedRuleId?: string | null;
  appliedCategoryId?: string | null;
  appliedActions: unknown[];
}

export async function runTransactionCreateMetadataUpdates({
  userId,
  householdId,
  transactionId,
  categoryId,
  finalMerchantId,
  decimalAmount,
  appliedRuleId,
  appliedCategoryId,
  appliedActions,
}: RunTransactionCreateMetadataUpdatesParams): Promise<void> {
  try {
    await updateCreateCategoryAndMerchantUsage({
      userId,
      householdId,
      categoryId,
      finalMerchantId,
      decimalAmount,
    });
  } catch (error) {
    console.error('Error updating usage analytics:', error);
  }

  try {
    await logCreateRuleExecution({
      userId,
      householdId,
      transactionId,
      appliedRuleId,
      appliedCategoryId,
      appliedActions,
    });
  } catch (error) {
    console.error('Error logging rule execution:', error);
  }
}
