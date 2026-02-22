import Decimal from 'decimal.js';

import { accounts } from '@/lib/db/schema';
import { validateCanonicalTransferInput } from '@/lib/transactions/transfer-contract';
import { createCanonicalTransferPair } from '@/lib/transactions/transfer-service';
import {
  autoLinkCreditDestinationBillPayment,
  handleTransferGoalContributions,
  trackTransferUsageSafely,
} from '@/lib/transactions/transaction-transfer-post-create';

interface GoalContribution {
  goalId: string;
  amount: number;
}

export async function createTransferTransactionBranch({
  userId,
  householdId,
  sourceAccountId,
  destinationAccountId,
  sourceAccount,
  destinationAccount,
  amount,
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
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAccount: typeof accounts.$inferSelect;
  destinationAccount: typeof accounts.$inferSelect;
  amount: Decimal;
  amountCents: number;
  date: string;
  description: string;
  notes?: string | null;
  isPending?: boolean;
  savingsGoalId?: string | null;
  goalContributions?: GoalContribution[];
  offlineId?: string | null;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  transactionId?: string;
}) {
  const sourceIsCreditAccount = sourceAccount.type === 'credit' || sourceAccount.type === 'line_of_credit';
  const destIsCreditAccount = destinationAccount.type === 'credit' || destinationAccount.type === 'line_of_credit';
  const isBalanceTransfer = sourceIsCreditAccount && destIsCreditAccount;

  const transferPayload = validateCanonicalTransferInput({
    userId,
    householdId,
    fromAccountId: sourceAccountId,
    toAccountId: destinationAccountId,
    amountCents,
    date,
    description,
    notes: notes || null,
    isPending,
    isBalanceTransfer,
    savingsGoalId: savingsGoalId || null,
    offlineId: offlineId || null,
    syncStatus,
    fromTransactionId: transactionId,
  });

  const transferResult = await createCanonicalTransferPair(transferPayload);
  const transferInId = transferResult.toTransactionId;

  await trackTransferUsageSafely({
    userId,
    householdId,
    sourceAccountId,
    destinationAccountId,
  });

  await autoLinkCreditDestinationBillPayment({
    destinationAccount,
    destinationAccountId,
    sourceAccountId,
    transferInId,
    amount,
    date,
    userId,
    householdId,
    description,
    isBalanceTransfer,
  });

  await handleTransferGoalContributions({
    transferInId,
    savingsGoalId,
    goalContributions,
    amount,
    userId,
    householdId,
  });

  return { transferInId };
}
