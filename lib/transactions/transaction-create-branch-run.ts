import type Decimal from 'decimal.js';

import { accounts } from '@/lib/db/schema';
import { executeCreateTransactionBranch } from '@/lib/transactions/transaction-create-branch-execution';
import type { GoalContribution } from '@/lib/transactions/transaction-create-request';
import type { TransactionMutations } from '@/lib/rules/types';

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
  effectiveIsTaxDeductible,
  effectiveTaxDeductionType,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  type: 'income' | 'expense' | 'transfer' | 'transfer_in' | 'transfer_out';
  accountId: string;
  account: typeof accounts.$inferSelect;
  toAccountId: string | null;
  toAccount: typeof accounts.$inferSelect | null;
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
  postCreationMutations: TransactionMutations | null;
  effectiveIsTaxDeductible: boolean;
  effectiveTaxDeductionType: 'business' | 'personal' | 'none';
}): Promise<{ transferInId: string | null } | Response> {
  const { transferInId, validationError } = await executeCreateTransactionBranch({
    userId,
    householdId,
    transactionId,
    type,
    accountId,
    account,
    toAccountId: toAccountId ?? undefined,
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
    syncStatus: (syncStatus ?? 'pending') as 'pending' | 'syncing' | 'synced' | 'error' | 'offline',
    appliedCategoryId,
    finalMerchantId,
    debtId,
    isSalesTaxable,
    postCreationMutations,
    effectiveIsTaxDeductible,
    effectiveTaxDeductionType,
  });

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  return { transferInId };
}
