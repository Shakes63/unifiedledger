import { findMatchingBillInstance } from '@/lib/bills/bill-matching-helpers';
import { formatCreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-match-format';
import {
  findScopedBillById,
  findCategoryPendingBillMatch,
} from '@/lib/transactions/transaction-create-bill-linking-queries';
import type { CreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-types';

export async function matchByGeneralBillHeuristics({
  transactionId,
  userId,
  householdId,
  description,
  amount,
  date,
  type,
  appliedCategoryId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  appliedCategoryId?: string | null;
}): Promise<CreateBillLinkMatch | null> {
  const billMatch = await findMatchingBillInstance(
    {
      id: transactionId,
      description,
      amount,
      date,
      type,
      categoryId: appliedCategoryId,
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

  return formatCreateBillLinkMatch({
    billId: billMatch.billId,
    instanceId: billMatch.instanceId,
    billName: bill.name,
    legacyDebtId: bill.debtId,
    notes: `Auto-matched bill payment: ${bill.name}`,
    logMessage: (paymentStatus) =>
      `Auto-matched bill payment: ${billMatch.billId}, Status: ${paymentStatus}`,
  });
}

export async function matchByCategoryFallback({
  userId,
  householdId,
  appliedCategoryId,
}: {
  userId: string;
  householdId: string;
  appliedCategoryId?: string | null;
}): Promise<CreateBillLinkMatch | null> {
  if (!appliedCategoryId) {
    return null;
  }

  const match = await findCategoryPendingBillMatch({
    userId,
    householdId,
    categoryId: appliedCategoryId,
  });
  if (!match) {
    return null;
  }

  return formatCreateBillLinkMatch({
    billId: match.bill.id,
    instanceId: match.instance.id,
    billName: match.bill.name,
    legacyDebtId: match.bill.debtId,
    notes: `Category-matched bill payment: ${match.bill.name}`,
    logMessage: (paymentStatus) =>
      `Category-matched bill payment: ${match.bill.id}, Status: ${paymentStatus}`,
  });
}
