import { deleteSalesTaxRecord } from '@/lib/sales-tax/transaction-sales-tax';
import { transactions } from '@/lib/db/schema';
import { logTransactionUpdateAudit } from '@/lib/transactions/transaction-update-audit';
import { autoLinkUpdatedExpenseBill } from '@/lib/transactions/transaction-update-bill-linking';
import type { TransactionUpdateInput } from '@/lib/transactions/transaction-update-validation';

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
  newDate: string;
  newAmount: number;
  newDescription: string;
  newNotes: string | null;
  newIsPending: boolean;
  newIsSalesTaxable: boolean;
}) {
  if (shouldDeleteSalesTaxRecord) {
    await deleteSalesTaxRecord(id);
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
