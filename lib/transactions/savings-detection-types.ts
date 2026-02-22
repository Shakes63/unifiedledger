export interface DetectedSavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  color: string;
  accountId: string | null;
}

export interface SavingsDetectionResult {
  suggestedGoalId: string | null;
  suggestedGoalName: string | null;
  linkedGoals: DetectedSavingsGoal[];
  confidence: 'high' | 'medium' | 'low' | 'none';
  reason: string;
  isSavingsAccount: boolean;
}
