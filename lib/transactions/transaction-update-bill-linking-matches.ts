import { findMatchingBillInstance } from '@/lib/bills/bill-matching-helpers';
import { transactions } from '@/lib/db/schema';
import {
  findCategoryPendingBillMatch,
  findScopedBillById,
  findScopedPendingBillInstanceById,
} from '@/lib/transactions/transaction-create-bill-linking-queries';

export interface UpdatedBillLinkMatch {
  templateId: string;
  templateName: string;
  occurrenceId: string;
  notes: string;
}

export async function matchUpdatedTransactionByExplicitBillInstance({
  billInstanceId,
  userId,
  householdId,
}: {
  billInstanceId?: string;
  userId: string;
  householdId: string;
}): Promise<UpdatedBillLinkMatch | null> {
  if (!billInstanceId) {
    return null;
  }

  const instance = await findScopedPendingBillInstanceById({
    billInstanceId,
    userId,
    householdId,
  });

  if (!instance) {
    return null;
  }

  return {
    templateId: instance.bill.id,
    templateName: instance.bill.name,
    occurrenceId: instance.instance.id,
    notes: `Bill payment update: ${instance.bill.name}`,
  };
}

export async function matchUpdatedTransactionByGeneralHeuristics({
  transactionId,
  userId,
  householdId,
  transactionType,
  newDescription,
  newAmount,
  newDate,
  newCategoryId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  transactionType: typeof transactions.$inferSelect['type'];
  newDescription: string;
  newAmount: number;
  newDate: string;
  newCategoryId: string | null;
}): Promise<UpdatedBillLinkMatch | null> {
  if (!transactionType) {
    return null;
  }

  const billMatch = await findMatchingBillInstance(
    {
      id: transactionId,
      description: newDescription,
      amount: newAmount,
      date: newDate,
      type: transactionType,
      categoryId: newCategoryId,
    },
    userId,
    householdId,
    70
  );

  if (!billMatch) {
    return null;
  }

  const bill = await findScopedBillById({
    billId: billMatch.billId,
    userId,
    householdId,
  });
  if (!bill) {
    return null;
  }

  return {
    templateId: bill.id,
    templateName: bill.name,
    occurrenceId: billMatch.instanceId,
    notes: `Auto-matched bill update: ${bill.name}`,
  };
}

export async function matchUpdatedTransactionByCategoryFallback({
  userId,
  householdId,
  categoryId,
}: {
  userId: string;
  householdId: string;
  categoryId: string;
}): Promise<UpdatedBillLinkMatch | null> {
  const match = await findCategoryPendingBillMatch({
    userId,
    householdId,
    categoryId,
  });
  if (!match) {
    return null;
  }

  return {
    templateId: match.bill.id,
    templateName: match.bill.name,
    occurrenceId: match.instance.id,
    notes: `Category-matched bill update: ${match.bill.name}`,
  };
}
