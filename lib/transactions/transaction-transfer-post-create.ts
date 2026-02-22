import Decimal from 'decimal.js';

import { trackTransferPairUsage } from '@/lib/analytics/usage-analytics-service';
import { accounts } from '@/lib/db/schema';
import { executeCreditDestinationBillAutoLink } from '@/lib/transactions/transaction-transfer-credit-linking';
import { executeTransferGoalContributionUpdates } from '@/lib/transactions/transaction-transfer-goal-execution';

interface GoalContribution {
  goalId: string;
  amount: number;
}

export async function trackTransferUsageSafely({
  userId,
  householdId,
  sourceAccountId,
  destinationAccountId,
}: {
  userId: string;
  householdId: string;
  sourceAccountId: string;
  destinationAccountId: string;
}): Promise<void> {
  try {
    await trackTransferPairUsage({
      userId,
      householdId,
      fromAccountId: sourceAccountId,
      toAccountId: destinationAccountId,
    });
  } catch (error) {
    console.error('Error tracking transfer pair usage:', error);
  }
}

export async function autoLinkCreditDestinationBillPayment({
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
}: {
  destinationAccount: typeof accounts.$inferSelect;
  destinationAccountId: string;
  sourceAccountId: string;
  transferInId: string;
  amount: Decimal;
  date: string;
  userId: string;
  householdId: string;
  description: string;
  isBalanceTransfer: boolean;
}): Promise<void> {
  await executeCreditDestinationBillAutoLink({
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
}

export async function handleTransferGoalContributions({
  transferInId,
  savingsGoalId,
  goalContributions,
  amount,
  userId,
  householdId,
}: {
  transferInId: string;
  savingsGoalId?: string | null;
  goalContributions?: GoalContribution[];
  amount: Decimal;
  userId: string;
  householdId: string;
}): Promise<void> {
  await executeTransferGoalContributionUpdates({
    transferInId,
    savingsGoalId,
    goalContributions,
    amount,
    userId,
    householdId,
  });
}
