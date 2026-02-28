import { transactions } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';
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

  const shouldUseCategoryDefaultTax =
    updateInput.useCategoryTaxDefault === true ||
    (updateInput.categoryId !== undefined &&
      updateInput.isTaxDeductible === undefined &&
      updateInput.taxDeductionType === undefined);

  if (!shouldUseCategoryDefaultTax) {
    return { ...derived, ...referenceValidation };
  }

  const effectiveCategoryId =
    updateInput.categoryId !== undefined ? derived.newCategoryId : transaction.categoryId;
  const categoryDefaults = effectiveCategoryId
    ? await db
        .select({
          isTaxDeductible: budgetCategories.isTaxDeductible,
          isBusinessCategory: budgetCategories.isBusinessCategory,
        })
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, effectiveCategoryId),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
          )
        )
        .limit(1)
    : [];

  const isTaxDeductible = Boolean(categoryDefaults[0]?.isTaxDeductible);
  const taxDeductionType: 'business' | 'personal' | 'none' = !isTaxDeductible
    ? 'none'
    : categoryDefaults[0]?.isBusinessCategory
      ? 'business'
      : 'personal';

  return {
    ...derived,
    newIsTaxDeductible: isTaxDeductible,
    newTaxDeductionType: taxDeductionType,
    ...referenceValidation,
  };
}
