import { transactions } from '@/lib/db/schema';
import {
  deriveUpdatedTransactionValues,
  type TransactionUpdateInput,
  validateUpdatedTransactionReferences,
} from '@/lib/transactions/transaction-update-validation';

export async function prepareStandardTransactionUpdate({
  userId,
  householdId,
  selectedEntityId,
  transaction,
  updateInput,
}: {
  userId: string;
  householdId: string;
  selectedEntityId: string;
  transaction: typeof transactions.$inferSelect;
  updateInput: TransactionUpdateInput;
}) {
  const derived = deriveUpdatedTransactionValues({
    transaction,
    input: updateInput,
  });

  const referenceValidation = await validateUpdatedTransactionReferences({
    userId,
    householdId,
    selectedEntityId,
    transaction,
    newAccountId: derived.newAccountId,
    newCategoryId: derived.newCategoryId,
    newMerchantId: derived.newMerchantId,
  });

  return { ...derived, ...referenceValidation };
}
