import { transactions } from '@/lib/db/schema';
import {
  shouldRematchUpdatedExpenseBill,
  unlinkExistingBillInstance,
} from '@/lib/transactions/transaction-update-bill-linking-helpers';
import {
  clearTransactionBillLink,
  executeMatchedBillLink,
  matchAndExecuteCategoryFallbackUpdatedBillLink,
  matchAndExecuteGeneralUpdatedBillLink,
} from '@/lib/transactions/transaction-update-bill-linking-flow';
import {
  matchUpdatedTransactionByExplicitBillInstance,
} from '@/lib/transactions/transaction-update-bill-linking-matches';

interface AutoLinkUpdatedExpenseBillParams {
  transactionId: string;
  userId: string;
  householdId: string;
  transaction: typeof transactions.$inferSelect;
  billInstanceId?: string;
  amountWasProvided: boolean;
  newAccountId: string;
  newAmount: number;
  newDate: string;
  newDescription: string;
  newCategoryId: string | null;
}

export async function autoLinkUpdatedExpenseBill({
  transactionId,
  userId,
  householdId,
  transaction,
  billInstanceId,
  amountWasProvided,
  newAccountId,
  newAmount,
  newDate,
  newDescription,
  newCategoryId,
}: AutoLinkUpdatedExpenseBillParams): Promise<void> {
  try {
    if (transaction.type !== 'expense') {
      return;
    }

    const explicitMatch = await matchUpdatedTransactionByExplicitBillInstance({
      billInstanceId,
      userId,
      householdId,
    });
    if (explicitMatch) {
      if (transaction.billId) {
        await unlinkExistingBillInstance({
          transactionId,
          userId,
          householdId,
        });
      }

      await executeMatchedBillLink({
        match: explicitMatch,
        transactionId,
        userId,
        householdId,
        newAccountId,
        newAmount,
        newDate,
      });
      return;
    }

    const shouldRematch = shouldRematchUpdatedExpenseBill({
      amountWasProvided,
      newAmount,
      newDate,
      newDescription,
      newCategoryId,
      transaction,
    });
    const categoryChanged = newCategoryId !== transaction.categoryId;

    if (!shouldRematch) {
      return;
    }

    if (transaction.billId) {
      await unlinkExistingBillInstance({
        transactionId,
        userId,
        householdId,
      });
      await clearTransactionBillLink(transactionId);
    }

    const matchedAny = await matchAndExecuteGeneralUpdatedBillLink({
      transactionId,
      userId,
      householdId,
      transactionType: transaction.type,
      newDescription,
      newAmount,
      newDate,
      newCategoryId,
      newAccountId,
    });
    if (matchedAny) {
      return;
    }

    if (!newCategoryId || !categoryChanged) {
      return;
    }

    const categoryMatched = await matchAndExecuteCategoryFallbackUpdatedBillLink({
      transactionId,
      userId,
      householdId,
      newAmount,
      newDate,
      newCategoryId: newCategoryId,
      newAccountId,
    });
    if (!categoryMatched) {
      return;
    }
  } catch (error) {
    console.error('Error auto-linking bill on update:', error);
  }
}
