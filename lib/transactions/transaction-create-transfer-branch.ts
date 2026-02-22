import type Decimal from 'decimal.js';

import { accounts } from '@/lib/db/schema';
import { createTransferTransactionBranch } from '@/lib/transactions/transaction-transfer-create';
import type { GoalContribution } from '@/lib/transactions/transaction-create-request';

function isTransferValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;
  return (
    message.includes('required') ||
    message.includes('Cannot transfer to the same account') ||
    message.includes('Amount must') ||
    message.includes('Date must be a valid date string') ||
    message.includes('Description is required')
  );
}

export async function executeTransferCreateBranchOrValidationError({
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
}: {
  userId: string;
  householdId: string;
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
  transactionId: string;
}): Promise<{ transferInId: string | null; validationError: string | null }> {
  if (!toAccount) {
    return {
      transferInId: null,
      validationError: 'Destination account is required for transfer',
    };
  }

  try {
    const transferResult = await createTransferTransactionBranch({
      userId,
      householdId,
      sourceAccountId: accountId,
      destinationAccountId: toAccountId,
      sourceAccount: account,
      destinationAccount: toAccount,
      amount: decimalAmount,
      amountCents,
      date,
      description,
      notes: notes || null,
      isPending,
      savingsGoalId: savingsGoalId || null,
      goalContributions: (goalContributions || []) as GoalContribution[],
      offlineId: offlineId || null,
      syncStatus,
      transactionId,
    });

    return { transferInId: transferResult.transferInId, validationError: null };
  } catch (error) {
    if (isTransferValidationError(error)) {
      return {
        transferInId: null,
        validationError: error.message,
      };
    }
    throw error;
  }
}
