import Decimal from 'decimal.js';

import { apiDebugLog } from '@/lib/api/route-helpers';
import { handleGoalContribution, handleMultipleContributions } from '@/lib/goals/contribution-handler';

interface GoalContribution {
  goalId: string;
  amount: number;
}

export async function executeTransferGoalContributionUpdates({
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
