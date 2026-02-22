import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { executeUpdatedBillLinkMatch } from '@/lib/transactions/transaction-update-bill-linking-execution';
import {
  matchUpdatedTransactionByCategoryFallback,
  matchUpdatedTransactionByGeneralHeuristics,
  type UpdatedBillLinkMatch,
} from '@/lib/transactions/transaction-update-bill-linking-matches';

export async function executeMatchedBillLink({
  match,
  transactionId,
  userId,
  householdId,
  newAccountId,
  newAmount,
  newDate,
}: {
  match: UpdatedBillLinkMatch;
  transactionId: string;
  userId: string;
  householdId: string;
  newAccountId: string;
  newAmount: number;
  newDate: string;
}): Promise<void> {
  await executeUpdatedBillLinkMatch({
    match,
    transactionId,
    userId,
    householdId,
    newAccountId,
    newAmount,
    newDate,
  });
}

export async function clearTransactionBillLink(transactionId: string): Promise<void> {
  await db
    .update(transactions)
    .set({
      billId: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(transactions.id, transactionId));
}

export async function matchAndExecuteGeneralUpdatedBillLink({
  transactionId,
  userId,
  householdId,
  transactionType,
  newDescription,
  newAmount,
  newDate,
  newCategoryId,
  newAccountId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  transactionType: string;
  newDescription: string;
  newAmount: number;
  newDate: string;
  newCategoryId: string | null;
  newAccountId: string;
}): Promise<boolean> {
  const generalMatch = await matchUpdatedTransactionByGeneralHeuristics({
    transactionId,
    userId,
    householdId,
    transactionType,
    newDescription,
    newAmount,
    newDate,
    newCategoryId,
  });

  if (generalMatch) {
    await executeMatchedBillLink({
      match: generalMatch,
      transactionId,
      userId,
      householdId,
      newAccountId,
      newAmount,
      newDate,
    });
    return true;
  }

  return false;
}

export async function matchAndExecuteCategoryFallbackUpdatedBillLink({
  transactionId,
  userId,
  householdId,
  newAmount,
  newDate,
  newCategoryId,
  newAccountId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  newAmount: number;
  newDate: string;
  newCategoryId: string;
  newAccountId: string;
}): Promise<boolean> {

  const categoryMatch = await matchUpdatedTransactionByCategoryFallback({
    userId,
    householdId,
    categoryId: newCategoryId,
  });
  if (!categoryMatch) {
    return false;
  }

  await executeMatchedBillLink({
    match: categoryMatch,
    transactionId,
    userId,
    householdId,
    newAccountId,
    newAmount,
    newDate,
  });

  return true;
}
