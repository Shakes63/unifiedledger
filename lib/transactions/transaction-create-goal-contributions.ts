import { handleGoalContribution, handleMultipleContributions } from '@/lib/goals/contribution-handler';
import { apiDebugLog } from '@/lib/api/route-helpers';

interface GoalContribution {
  goalId: string;
  amount: number;
}

interface HandleTransactionGoalContributionsParams {
  transactionId: string;
  userId: string;
  householdId: string;
  amount: number;
  savingsGoalId?: string;
  goalContributions?: GoalContribution[];
}

export async function handleTransactionGoalContributions({
  transactionId,
  userId,
  householdId,
  amount,
  savingsGoalId,
  goalContributions,
}: HandleTransactionGoalContributionsParams): Promise<void> {
  if (!savingsGoalId && (!goalContributions || goalContributions.length === 0)) {
    return;
  }

  try {
    if (goalContributions && goalContributions.length > 0) {
      // Contributions cannot exceed the funding transaction (M-DBG-12: a $10
      // transaction with a $10,000 goalContributions payload previously credited
      // the goal $10,000 and fired milestones).
      const totalRequested = goalContributions.reduce(
        (sum, contribution) => sum + (Number(contribution.amount) || 0),
        0
      );
      if (totalRequested > Math.abs(amount) + 0.005) {
        console.error(
          `Goal contributions (${totalRequested}) exceed transaction amount (${amount}); skipping`
        );
        return;
      }

      const contributionResults = await handleMultipleContributions(
        goalContributions,
        transactionId,
        userId,
        householdId
      );
      const achievedMilestones = contributionResults.flatMap((result) => result.milestonesAchieved);
      if (achievedMilestones.length > 0) {
        apiDebugLog(
          'transactions:create',
          `Transaction ${transactionId}: Milestones achieved: ${achievedMilestones.join(', ')}%`
        );
      }
      return;
    }

    if (!savingsGoalId) {
      return;
    }

    const result = await handleGoalContribution(
      savingsGoalId,
      Math.abs(amount),
      transactionId,
      userId,
      householdId
    );
    if (result.milestonesAchieved.length > 0) {
      apiDebugLog(
        'transactions:create',
        `Transaction ${transactionId}: Milestones achieved: ${result.milestonesAchieved.join(', ')}%`
      );
    }
  } catch (error) {
    console.error('Error handling savings goal contribution:', error);
  }
}
