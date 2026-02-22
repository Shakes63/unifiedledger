import type {
  DetectedSavingsGoal,
  SavingsDetectionResult,
} from '@/lib/transactions/savings-detection-types';

const DEFAULT_GOAL_COLOR = '#10b981';

export function mapDetectedGoals(
  goals: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number | null;
    color: string | null;
    accountId: string | null;
  }>
): DetectedSavingsGoal[] {
  return goals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount || 0,
    color: goal.color || DEFAULT_GOAL_COLOR,
    accountId: goal.accountId,
  }));
}

export function buildSavingsDetectionResult({
  destinationAccountName,
  isSavingsAccount,
  mappedGoals,
}: {
  destinationAccountName: string;
  isSavingsAccount: boolean;
  mappedGoals: DetectedSavingsGoal[];
}): SavingsDetectionResult {
  if (mappedGoals.length === 1) {
    return {
      suggestedGoalId: mappedGoals[0].id,
      suggestedGoalName: mappedGoals[0].name,
      linkedGoals: mappedGoals,
      confidence: 'high',
      reason: `This transfer will contribute to your "${mappedGoals[0].name}" goal`,
      isSavingsAccount,
    };
  }

  if (mappedGoals.length > 1) {
    return {
      suggestedGoalId: null,
      suggestedGoalName: null,
      linkedGoals: mappedGoals,
      confidence: 'medium',
      reason: `${mappedGoals.length} goals are linked to this account. Select one to track your progress.`,
      isSavingsAccount,
    };
  }

  if (isSavingsAccount) {
    return {
      suggestedGoalId: null,
      suggestedGoalName: null,
      linkedGoals: [],
      confidence: 'low',
      reason: `Consider linking a savings goal to "${destinationAccountName}" to track your progress`,
      isSavingsAccount: true,
    };
  }

  return {
    suggestedGoalId: null,
    suggestedGoalName: null,
    linkedGoals: [],
    confidence: 'none',
    reason: '',
    isSavingsAccount: false,
  };
}

export function buildMissingDestinationAccountResult(): SavingsDetectionResult {
  return {
    suggestedGoalId: null,
    suggestedGoalName: null,
    linkedGoals: [],
    confidence: 'none',
    reason: 'Destination account not found',
    isSavingsAccount: false,
  };
}
