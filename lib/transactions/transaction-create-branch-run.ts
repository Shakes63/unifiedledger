import type Decimal from 'decimal.js';

import { executeCreateTransactionBranch } from '@/lib/transactions/transaction-create-branch-execution';
import type { GoalContribution } from '@/lib/transactions/transaction-create-request';

export async function executeCreateBranchOrResponse({
  userId,
  householdId,
  transactionId,
  type,
  accountId,
  account,
  toAccountId,
  toAccount,
  decimalAmount,
  amountCents,
  date,
  description,
  notes,
  isPending,
  savingsGoalId,
  goalContributions,
  offlineId,
  syncStatus,
  appliedCategoryId,
  finalMerchantId,
  debtId,
  isSalesTaxable,
  postCreationMutations,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  accountId: string;
  account: { name: string; id: string; balance?: number | null; includeInNetWorth?: boolean | null };
  toAccountId: string | null;
  toAccount: { name: string; id: string } | null;
  decimalAmount: Decimal;
  amountCents: number;
  date: string;
  description: string;
  notes: string | null;
  isPending: boolean;
  savingsGoalId: string | null;
  goalContributions: GoalContribution[] | undefined;
  offlineId: string | null;
  syncStatus: string | null;
  appliedCategoryId: string | null;
  finalMerchantId: string | null;
  debtId: string | null;
  isSalesTaxable: boolean;
  postCreationMutations: Array<{
    setDescription?: string;
    setMerchantId?: string;
    setCategoryId?: string;
    addTags?: string[];
  }>;
}): Promise<{ transferInId: string | null } | Response> {
  const { transferInId, validationError } = await executeCreateTransactionBranch({
    userId,
    householdId,
    transactionId,
    type,
    accountId,
    account,
    toAccountId,
    toAccount,
    decimalAmount,
    amountCents,
    date,
    description,
    notes,
    isPending,
    savingsGoalId,
    goalContributions,
    offlineId,
    syncStatus,
    appliedCategoryId,
    finalMerchantId,
    debtId,
    isSalesTaxable,
    postCreationMutations,
  });

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  return { transferInId };
}
