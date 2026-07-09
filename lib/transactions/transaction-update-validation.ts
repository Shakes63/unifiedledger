/**
 * Input validation + derived values for the transaction UPDATE flow.
 * Consolidated with the former transaction-update-reference-validation shim
 * during the post-audit cleanup; behavior is unchanged.
 */
import Decimal from 'decimal.js';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, budgetCategories, merchants, transactions } from '@/lib/db/schema';
import { requireAccountEntityAccess } from '@/lib/household/entities';
import { amountToCents, getTransactionAmountCents } from '@/lib/transactions/money-movement-service';

// ---------------------------------------------------------------------------
// Reference validation (formerly transaction-update-reference-validation.ts)
// ---------------------------------------------------------------------------

async function validateUpdatedAccountReference({
  userId,
  householdId,
  selectedEntityId,
  currentAccountId,
  newAccountId,
}: {
  userId: string;
  householdId: string;
  selectedEntityId: string;
  currentAccountId: string;
  newAccountId: string;
}): Promise<Response | null> {
  if (newAccountId === currentAccountId) {
    return null;
  }

  const newAccount = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, newAccountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);

  if (newAccount.length === 0) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  const newAccountEntity = await requireAccountEntityAccess(
    userId,
    householdId,
    newAccount[0].entityId
  );
  if (newAccountEntity.id !== selectedEntityId) {
    return Response.json(
      { error: 'Account does not belong to the selected entity' },
      { status: 403 }
    );
  }

  return null;
}

async function validateUpdatedCategoryReference({
  userId,
  householdId,
  newCategoryId,
}: {
  userId: string;
  householdId: string;
  newCategoryId: string | null;
}): Promise<Response | null> {
  if (!newCategoryId) {
    return null;
  }

  const category = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.id, newCategoryId),
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId)
      )
    )
    .limit(1);

  if (category.length === 0) {
    return Response.json({ error: 'Category not found' }, { status: 404 });
  }

  return null;
}

async function resolveSalesTaxabilityFromMerchantChange({
  transaction,
  newMerchantId,
}: {
  transaction: typeof transactions.$inferSelect;
  newMerchantId: string | null;
}): Promise<{
  newIsSalesTaxable: boolean;
  shouldDeleteSalesTaxRecord: boolean;
}> {
  let newIsSalesTaxable = Boolean(transaction.isSalesTaxable);
  let shouldDeleteSalesTaxRecord = false;

  if (transaction.type !== 'income' || newMerchantId === transaction.merchantId || !newMerchantId) {
    return { newIsSalesTaxable, shouldDeleteSalesTaxRecord };
  }

  const merchantExemptCheck = await db
    .select({ isSalesTaxExempt: merchants.isSalesTaxExempt })
    .from(merchants)
    .where(eq(merchants.id, newMerchantId))
    .limit(1);
  const merchantIsSalesTaxExempt = merchantExemptCheck[0]?.isSalesTaxExempt || false;

  if (merchantIsSalesTaxExempt && transaction.isSalesTaxable) {
    newIsSalesTaxable = false;
    shouldDeleteSalesTaxRecord = true;
  }

  return {
    newIsSalesTaxable,
    shouldDeleteSalesTaxRecord,
  };
}

export interface TransactionUpdateInput {
  accountId?: string;
  categoryId?: string | null;
  merchantId?: string | null;
  isTaxDeductible?: boolean;
  taxDeductionType?: 'business' | 'personal' | 'none';
  useCategoryTaxDefault?: boolean;
  date?: string;
  amount?: string | number;
  description?: string;
  notes?: string | null;
  isPending?: boolean;
  transferId?: string;
  transferDestinationAccountId?: string;
  transferSourceAccountId?: string;
}

export function hasAnyTransactionUpdateField(input: TransactionUpdateInput): boolean {
  return (
    input.accountId !== undefined ||
    input.categoryId !== undefined ||
    input.merchantId !== undefined ||
    input.isTaxDeductible !== undefined ||
    input.taxDeductionType !== undefined ||
    input.useCategoryTaxDefault !== undefined ||
    input.date !== undefined ||
    input.amount !== undefined ||
    input.description !== undefined ||
    input.notes !== undefined ||
    input.isPending !== undefined ||
    input.transferId !== undefined ||
    input.transferDestinationAccountId !== undefined ||
    input.transferSourceAccountId !== undefined
  );
}

export function deriveUpdatedTransactionValues({
  transaction,
  input,
}: {
  transaction: typeof transactions.$inferSelect;
  input: TransactionUpdateInput;
}) {
  const newAccountId = input.accountId || transaction.accountId;
  const newAmount = input.amount ? new Decimal(input.amount) : new Decimal(transaction.amount);
  const oldAmountCents = getTransactionAmountCents(transaction);
  const newAmountCents = input.amount ? amountToCents(newAmount) : oldAmountCents;
  const newDate = input.date || transaction.date;
  const newDescription = input.description || transaction.description;
  const newNotes = input.notes !== undefined ? input.notes : transaction.notes;
  const newIsPending = input.isPending !== undefined ? input.isPending : transaction.isPending;
  const newCategoryId = input.categoryId !== undefined ? input.categoryId : transaction.categoryId;
  const newMerchantId = input.merchantId !== undefined ? input.merchantId : transaction.merchantId;
  const newIsTaxDeductible =
    input.isTaxDeductible !== undefined ? input.isTaxDeductible : Boolean(transaction.isTaxDeductible);
  const newTaxDeductionType =
    input.taxDeductionType !== undefined
      ? input.taxDeductionType
      : ((transaction.taxDeductionType ?? 'none') as 'business' | 'personal' | 'none');

  return {
    newAccountId,
    newAmount,
    oldAmountCents,
    newAmountCents,
    newDate,
    newDescription,
    newNotes,
    newIsPending,
    newCategoryId,
    newMerchantId,
    newIsTaxDeductible,
    newTaxDeductionType,
  };
}

export async function validateUpdatedTransactionReferences({
  userId,
  householdId,
  selectedEntityId,
  transaction,
  newAccountId,
  newCategoryId,
  newMerchantId,
}: {
  userId: string;
  householdId: string;
  selectedEntityId: string;
  transaction: typeof transactions.$inferSelect;
  newAccountId: string;
  newCategoryId: string | null;
  newMerchantId: string | null;
}): Promise<{
  errorResponse: Response | null;
  newIsSalesTaxable: boolean;
  shouldDeleteSalesTaxRecord: boolean;
}> {
  const accountValidationError = await validateUpdatedAccountReference({
    userId,
    householdId,
    selectedEntityId,
    currentAccountId: transaction.accountId,
    newAccountId,
  });
  if (accountValidationError) {
    return {
      errorResponse: accountValidationError,
      newIsSalesTaxable: Boolean(transaction.isSalesTaxable),
      shouldDeleteSalesTaxRecord: false,
    };
  }

  const categoryValidationError = await validateUpdatedCategoryReference({
    userId,
    householdId,
    newCategoryId,
  });
  if (categoryValidationError) {
    return {
      errorResponse: categoryValidationError,
      newIsSalesTaxable: Boolean(transaction.isSalesTaxable),
      shouldDeleteSalesTaxRecord: false,
    };
  }

  const { newIsSalesTaxable, shouldDeleteSalesTaxRecord } =
    await resolveSalesTaxabilityFromMerchantChange({
      transaction,
      newMerchantId,
    });

  return {
    errorResponse: null,
    newIsSalesTaxable,
    shouldDeleteSalesTaxRecord,
  };
}
