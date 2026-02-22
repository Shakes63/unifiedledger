import {
  matchByChargedAccount,
  matchByExplicitBillInstance,
} from '@/lib/transactions/transaction-create-bill-linking-matches';
import {
  matchByCategoryFallback,
  matchByGeneralBillHeuristics,
} from '@/lib/transactions/transaction-create-bill-linking-additional-matches';
import type { CreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-types';

interface FindCreateBillLinkMatchParams {
  transactionId: string;
  userId: string;
  householdId: string;
  billInstanceId?: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  appliedCategoryId?: string | null;
}

export async function findCreateBillLinkMatch({
  transactionId,
  userId,
  householdId,
  billInstanceId,
  accountId,
  description,
  amount,
  date,
  type,
  appliedCategoryId,
}: FindCreateBillLinkMatchParams): Promise<CreateBillLinkMatch | null> {
  const explicitMatch = await matchByExplicitBillInstance({
    transactionId,
    userId,
    householdId,
    billInstanceId,
    accountId,
    description,
    amount,
    date,
  });
  if (explicitMatch) {
    return explicitMatch;
  }

  const chargedMatch = await matchByChargedAccount({
    transactionId,
    userId,
    householdId,
    accountId,
    description,
    amount,
    date,
  });
  if (chargedMatch) {
    return chargedMatch;
  }

  const generalMatch = await matchByGeneralBillHeuristics({
    transactionId,
    userId,
    householdId,
    description,
    amount,
    date,
    type,
    appliedCategoryId,
  });
  if (generalMatch) {
    return generalMatch;
  }

  return matchByCategoryFallback({
    userId,
    householdId,
    appliedCategoryId,
  });
}
