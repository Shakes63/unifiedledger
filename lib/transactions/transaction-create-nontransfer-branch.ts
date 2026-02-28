import Decimal from 'decimal.js';

import { accounts } from '@/lib/db/schema';
import type { TransactionMutations } from '@/lib/rules/types';
import { executeNonTransferCreate } from '@/lib/transactions/transaction-create-nontransfer-execution';
import { runTransactionCreatePostMutations } from '@/lib/transactions/transaction-create-post-mutations';
import type { GoalContribution } from '@/lib/transactions/transaction-create-request';

export async function executeNonTransferCreateBranch({
  userId,
  householdId,
  transactionId,
  accountId,
  account,
  appliedCategoryId,
  finalMerchantId,
  debtId,
  savingsGoalId,
  date,
  amountCents,
  description,
  notes,
  type,
  isPending,
  isSalesTaxable,
  postCreationMutations,
  effectiveIsTaxDeductible,
  effectiveTaxDeductionType,
  offlineId,
  syncStatus,
  decimalAmount,
  goalContributions,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  accountId: string;
  account: typeof accounts.$inferSelect;
  appliedCategoryId: string | null;
  finalMerchantId: string | null;
  debtId?: string | null;
  savingsGoalId?: string | null;
  date: string;
  amountCents: number;
  description: string;
  notes?: string | null;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  isPending: boolean;
  isSalesTaxable: boolean;
  postCreationMutations: TransactionMutations | null;
  effectiveIsTaxDeductible: boolean;
  effectiveTaxDeductionType: 'business' | 'personal' | 'none';
  offlineId?: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  decimalAmount: Decimal;
  goalContributions?: GoalContribution[];
}): Promise<void> {
  await executeNonTransferCreate({
    userId,
    householdId,
    transactionId,
    accountId,
    account,
    appliedCategoryId,
    finalMerchantId,
    debtId: debtId ?? undefined,
    savingsGoalId: savingsGoalId ?? undefined,
    date,
    amountCents,
    finalDescription: description,
    notes: notes ?? undefined,
    type,
    isPending,
    isSalesTaxable,
    postCreationMutations,
    effectiveIsTaxDeductible,
    effectiveTaxDeductionType,
    offlineId: offlineId ?? undefined,
    syncStatus,
  });

  await runTransactionCreatePostMutations({
    transactionId,
    userId,
    householdId,
    postCreationMutations: postCreationMutations ?? undefined,
    transactionIsTaxDeductible: effectiveIsTaxDeductible,
    appliedCategoryId,
    amount: decimalAmount.toNumber(),
    date,
    savingsGoalId: savingsGoalId ?? undefined,
    goalContributions,
  });
}
