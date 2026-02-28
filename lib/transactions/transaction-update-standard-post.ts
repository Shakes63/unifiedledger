import {
  deleteSalesTaxRecord,
  upsertSalesTaxSnapshot,
} from '@/lib/sales-tax/transaction-sales-tax';
import { transactions } from '@/lib/db/schema';
import { logTransactionUpdateAudit } from '@/lib/transactions/transaction-update-audit';
import { autoLinkUpdatedExpenseBill } from '@/lib/transactions/transaction-update-bill-linking';
import { reclassifyTransaction, removeTransactionClassifications } from '@/lib/tax/auto-classify';
import type { TransactionUpdateInput } from '@/lib/transactions/transaction-update-validation';
import { amountToCents } from '@/lib/transactions/money-movement-service';

export async function runStandardUpdatePostActions({
  id,
  userId,
  householdId,
  transaction,
  billInstanceId,
  updateInput,
  shouldDeleteSalesTaxRecord,
  newAccountId,
  newCategoryId,
  newMerchantId,
  newIsTaxDeductible,
  newTaxDeductionType,
  newDate,
  newAmount,
  newDescription,
  newNotes,
  newIsPending,
  newIsSalesTaxable,
}: {
  id: string;
  userId: string;
  householdId: string;
  transaction: typeof transactions.$inferSelect;
  billInstanceId?: string;
  updateInput: TransactionUpdateInput;
  shouldDeleteSalesTaxRecord: boolean;
  newAccountId: string;
  newCategoryId: string | null;
  newMerchantId: string | null;
  newIsTaxDeductible: boolean;
  newTaxDeductionType: 'business' | 'personal' | 'none';
  newDate: string;
  newAmount: number;
  newDescription: string;
  newNotes: string | null;
  newIsPending: boolean;
  newIsSalesTaxable: boolean;
}) {
  if (shouldDeleteSalesTaxRecord || transaction.type !== 'income' || !newIsSalesTaxable) {
    await deleteSalesTaxRecord(id);
  } else {
    await upsertSalesTaxSnapshot({
      transactionId: id,
      userId,
      householdId,
      accountId: newAccountId,
      amountCents: amountToCents(newAmount),
      date: newDate,
    });
  }

  await logTransactionUpdateAudit({
    transactionId: id,
    userId,
    householdId,
    transaction,
    newAccountId,
    newCategoryId,
    newMerchantId,
    newDate,
    newAmount,
    newDescription,
    newNotes,
    newIsPending,
    newIsTaxDeductible,
    newTaxDeductionType,
    newIsSalesTaxable,
  });

  await autoLinkUpdatedExpenseBill({
    transactionId: id,
    userId,
    householdId,
    transaction,
    billInstanceId,
    amountWasProvided: updateInput.amount !== undefined,
    newAccountId,
    newAmount,
    newDate,
    newDescription,
    newCategoryId,
  });

  const wasTaxDeductible = Boolean(transaction.isTaxDeductible);
  const taxEligibilityChanged =
    updateInput.categoryId !== undefined ||
    updateInput.isTaxDeductible !== undefined ||
    updateInput.useCategoryTaxDefault === true;
  const deductibleAmountOrDateChanged =
    (updateInput.amount !== undefined || updateInput.date !== undefined) &&
    (wasTaxDeductible || newIsTaxDeductible);
  const shouldReclassifyTax = taxEligibilityChanged || deductibleAmountOrDateChanged;

  if (!shouldReclassifyTax) {
    return;
  }

  if (!newIsTaxDeductible || !newCategoryId || newTaxDeductionType === 'none') {
    await removeTransactionClassifications(id);
    return;
  }

  await reclassifyTransaction(
    userId,
    householdId,
    id,
    newCategoryId,
    newAmount,
    newDate,
    newIsTaxDeductible
  );
}

export function buildStandardUpdateSuccessResponse(id: string): Response {
  return Response.json(
    {
      id,
      message: 'Transaction updated successfully',
    },
    { status: 200 }
  );
}
