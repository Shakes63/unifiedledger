import { eq } from 'drizzle-orm';

import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { transactions } from '@/lib/db/schema';
import { buildTransactionAmountFields } from '@/lib/transactions/money-movement-service';
import {
  adjustUpdatedTransactionAccountBalances,
  resolveUpdatedTransactionEntityId,
  shouldAdjustAccountBalances,
} from '@/lib/transactions/transaction-update-nontransfer';
import {
  type TransactionUpdateInput,
} from '@/lib/transactions/transaction-update-validation';
import { prepareStandardTransactionUpdate } from '@/lib/transactions/transaction-update-standard-prepare';
import {
  buildStandardUpdateSuccessResponse,
  runStandardUpdatePostActions,
} from '@/lib/transactions/transaction-update-standard-post';

export async function executeStandardTransactionUpdateBranch({
  id,
  userId,
  householdId,
  selectedEntityId,
  transaction,
  updateInput,
  billInstanceId,
}: {
  id: string;
  userId: string;
  householdId: string;
  selectedEntityId: string;
  transaction: typeof transactions.$inferSelect;
  updateInput: TransactionUpdateInput;
  billInstanceId?: string;
}): Promise<Response> {
  const {
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
    errorResponse,
    newIsSalesTaxable,
    shouldDeleteSalesTaxRecord,
  } = await prepareStandardTransactionUpdate({
    userId,
    householdId,
    selectedEntityId,
    transaction,
    updateInput,
  });

  if (errorResponse) {
    return errorResponse;
  }

  await runInDatabaseTransaction(async (tx) => {
    if (shouldAdjustAccountBalances(updateInput.amount, newAccountId, transaction.accountId)) {
      await adjustUpdatedTransactionAccountBalances(tx, {
        transaction,
        newAccountId,
        oldAmountCents,
        newAmountCents,
      });
    }

    const transactionEntityId = await resolveUpdatedTransactionEntityId(tx, {
      householdId,
      userId,
      newAccountId,
      transaction,
    });

    await tx
      .update(transactions)
      .set({
        entityId: transactionEntityId,
        accountId: newAccountId,
        categoryId: newCategoryId,
        merchantId: newMerchantId,
        transferId: transaction.transferId,
        transferGroupId: transaction.transferGroupId,
        transferSourceAccountId: transaction.transferSourceAccountId,
        transferDestinationAccountId: transaction.transferDestinationAccountId,
        date: newDate,
        ...buildTransactionAmountFields(newAmountCents),
        description: newDescription,
        notes: newNotes,
        isPending: newIsPending,
        isSalesTaxable: newIsSalesTaxable,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(transactions.id, id));
  });

  await runStandardUpdatePostActions({
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
    newAmount: newAmount.toNumber(),
    newDescription,
    newNotes,
    newIsPending,
    newIsSalesTaxable,
  });

  return buildStandardUpdateSuccessResponse(id);
}
