import Decimal from 'decimal.js';
import { transactions } from '@/lib/db/schema';
import { amountToCents, getTransactionAmountCents } from '@/lib/transactions/money-movement-service';
import {
  resolveSalesTaxabilityFromMerchantChange,
  validateUpdatedAccountReference,
  validateUpdatedCategoryReference,
} from '@/lib/transactions/transaction-update-reference-validation';

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
