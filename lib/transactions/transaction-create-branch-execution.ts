import Decimal from 'decimal.js';

import { accounts } from '@/lib/db/schema';
import type { TransactionMutations } from '@/lib/rules/types';
import { executeNonTransferCreateBranch } from '@/lib/transactions/transaction-create-nontransfer-branch';
import type { GoalContribution } from '@/lib/transactions/transaction-create-request';
import { executeTransferCreateBranchOrValidationError } from '@/lib/transactions/transaction-create-transfer-branch';

export async function executeCreateTransactionBranch({
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
  type: 'income' | 'expense' | 'transfer' | 'transfer_in' | 'transfer_out';
  accountId: string;
  account: typeof accounts.$inferSelect;
  toAccountId?: string;
  toAccount: typeof accounts.$inferSelect | null;
  decimalAmount: Decimal;
  amountCents: number;
  date: string;
  description: string;
  notes?: string | null;
  isPending: boolean;
  savingsGoalId?: string | null;
  goalContributions?: GoalContribution[];
  offlineId?: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  appliedCategoryId: string | null;
  finalMerchantId: string | null;
  debtId?: string | null;
  isSalesTaxable: boolean;
  postCreationMutations: TransactionMutations | null;
}): Promise<{ transferInId: string | null; validationError: string | null }> {
  if (type === 'transfer' && toAccount) {
    return executeTransferCreateBranchOrValidationError({
      userId,
      householdId,
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
      transactionId,
    });
  }

  const nonTransferType = type as 'income' | 'expense' | 'transfer_in' | 'transfer_out';

  await executeNonTransferCreateBranch({
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
    type: nonTransferType,
    isPending,
    isSalesTaxable,
    postCreationMutations,
    offlineId,
    syncStatus,
    decimalAmount,
    goalContributions,
  });

  return { transferInId: null, validationError: null };
}
