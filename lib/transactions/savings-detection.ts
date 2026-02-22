import {
  buildMissingDestinationAccountResult,
  buildSavingsDetectionResult,
  mapDetectedGoals,
} from '@/lib/transactions/savings-detection-result';
import {
  getActiveGoalsForAccount,
  getDestinationAccount,
  hasAnyActiveGoalsForAccount,
} from '@/lib/transactions/savings-detection-queries';
import type {
  DetectedSavingsGoal,
  SavingsDetectionResult,
} from '@/lib/transactions/savings-detection-types';

export type { DetectedSavingsGoal, SavingsDetectionResult };

/**
 * Detect savings goals linked to a destination account.
 * Used to auto-suggest goals when creating transfers.
 * 
 * @param destinationAccountId - The ID of the account being transferred to
 * @param householdId - The household ID for scoping
 * @returns Detection result with suggested goal and confidence level
 */
export async function detectSavingsGoal(
  destinationAccountId: string,
  householdId: string
): Promise<SavingsDetectionResult> {
  const destinationAccount = await getDestinationAccount({
    destinationAccountId,
    householdId,
  });
  if (!destinationAccount) {
    return buildMissingDestinationAccountResult();
  }

  const isSavingsAccount = destinationAccount.type === 'savings';
  const linkedGoals = await getActiveGoalsForAccount({
    accountId: destinationAccountId,
    householdId,
  });
  const mappedGoals: DetectedSavingsGoal[] = mapDetectedGoals(linkedGoals);

  return buildSavingsDetectionResult({
    destinationAccountName: destinationAccount.name,
    isSavingsAccount,
    mappedGoals,
  });
}

/**
 * Check if an account has any linked savings goals
 * @param accountId - The account ID to check
 * @param householdId - The household ID for scoping
 * @returns Boolean indicating if goals are linked
 */
export async function hasLinkedGoals(
  accountId: string,
  householdId: string
): Promise<boolean> {
  return hasAnyActiveGoalsForAccount({ accountId, householdId });
}
