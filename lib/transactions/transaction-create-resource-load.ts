import { accounts, budgetCategories } from '@/lib/db/schema';
import {
  loadCreateTransactionResources,
  mapCreateTransactionValidationError,
} from '@/lib/transactions/transaction-create-validation';

export async function loadCreateAccountsOrResponse({
  userId,
  householdId,
  accountId,
  toAccountId,
  categoryId,
  type,
  selectedEntityId,
}: {
  userId: string;
  householdId: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  type: string;
  selectedEntityId: string;
}): Promise<
  | {
      account: typeof accounts.$inferSelect;
      toAccount: typeof accounts.$inferSelect | null;
      category: typeof budgetCategories.$inferSelect | null;
    }
  | Response
> {
  try {
    return await loadCreateTransactionResources({
      userId,
      householdId,
      accountId,
      toAccountId: toAccountId ?? undefined,
      categoryId: categoryId ?? undefined,
      type,
      selectedEntityId,
    });
  } catch (error) {
    const mappedValidationError = mapCreateTransactionValidationError(error);
    if (mappedValidationError) {
      return mappedValidationError;
    }
    throw error;
  }
}
