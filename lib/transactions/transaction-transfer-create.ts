/**
 * Transfer branch of the transaction CREATE flow: creates the canonical pair
 * through transfer-service, then runs post-create side effects (credit-account
 * bill linking and savings-goal contributions).
 *
 * Consolidated from 4 single-use shim files (credit-linking / goal-execution /
 * post-create / head) during the post-audit cleanup; behavior is unchanged.
 */
import Decimal from 'decimal.js';
import { apiDebugLog } from '@/lib/api/route-helpers';
import { findCreditPaymentBillInstance, processBillPayment } from '@/lib/bills/bill-payment-utils';
import { accounts } from '@/lib/db/schema';
import {
  handleGoalContribution,
  handleMultipleContributions,
} from '@/lib/goals/contribution-handler';
import { trackTransferPairUsage } from '@/lib/analytics/usage-analytics-service';
import { validateCanonicalTransferInput } from '@/lib/transactions/transfer-contract';
import { createCanonicalTransferPair } from '@/lib/transactions/transfer-service';

// ---------------------------------------------------------------------------
// from transaction-transfer-credit-linking.ts
// ---------------------------------------------------------------------------
async function executeCreditDestinationBillAutoLink({
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
  const destinationIsCredit =
    destinationAccount.type === 'credit' || destinationAccount.type === 'line_of_credit';
  if (!destinationIsCredit || isBalanceTransfer) {
    return;
  }

  try {
    const billMatch = await findCreditPaymentBillInstance(
      destinationAccountId,
      amount.toNumber(),
      date,
      userId,
      householdId,
      7
    );
    if (!billMatch) {
      return;
    }

    const paymentResult = await processBillPayment({
      billId: billMatch.billId,
      instanceId: billMatch.instanceId,
      transactionId: transferInId,
      paymentAmount: amount.toNumber(),
      paymentDate: date,
      userId,
      householdId,
      paymentMethod: 'transfer',
      linkedAccountId: sourceAccountId,
      notes: `Auto-linked from transfer: ${description}`,
    });

    if (paymentResult.success) {
      apiDebugLog(
        'transactions:create',
        `Credit card payment auto-linked: Bill ${billMatch.billId}, Instance ${billMatch.instanceId}, Status: ${paymentResult.paymentStatus}`
      );
    }
  } catch (error) {
    console.error('Error auto-linking credit card payment to bill:', error);
  }
}

// ---------------------------------------------------------------------------
// from transaction-transfer-goal-execution.ts
// ---------------------------------------------------------------------------
interface GoalContribution {
  goalId: string;
  amount: number;
}

async function executeTransferGoalContributionUpdates({
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
  if (!savingsGoalId && (!goalContributions || goalContributions.length === 0)) {
    return;
  }

  try {
    if (goalContributions && goalContributions.length > 0) {
      const contributionResults = await handleMultipleContributions(
        goalContributions,
        transferInId,
        userId,
        householdId
      );
      const achievedMilestones = contributionResults.flatMap((result) => result.milestonesAchieved);
      if (achievedMilestones.length > 0) {
        apiDebugLog(
          'transactions:create',
          `Transfer ${transferInId}: Milestones achieved: ${achievedMilestones.join(', ')}%`
        );
      }
      return;
    }

    if (!savingsGoalId) {
      return;
    }

    const result = await handleGoalContribution(
      savingsGoalId,
      amount.toNumber(),
      transferInId,
      userId,
      householdId
    );
    if (result.milestonesAchieved.length > 0) {
      apiDebugLog(
        'transactions:create',
        `Transfer ${transferInId}: Milestones achieved: ${result.milestonesAchieved.join(', ')}%`
      );
    }
  } catch (error) {
    console.error('Error handling savings goal contribution:', error);
  }
}

// ---------------------------------------------------------------------------
// from transaction-transfer-post-create.ts
// ---------------------------------------------------------------------------
interface GoalContribution {
  goalId: string;
  amount: number;
}

async function trackTransferUsageSafely({
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

async function autoLinkCreditDestinationBillPayment({
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

async function handleTransferGoalContributions({
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

// ---------------------------------------------------------------------------
// from transaction-transfer-create.ts
// ---------------------------------------------------------------------------
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
