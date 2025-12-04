import { db } from '@/lib/db';
import { savingsGoals, accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Savings goal type for detection results
 */
export interface DetectedSavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  color: string;
  accountId: string | null;
}

/**
 * Result of savings goal auto-detection
 */
export interface SavingsDetectionResult {
  /** The suggested goal ID to auto-select (if confidence is high) */
  suggestedGoalId: string | null;
  /** Name of the suggested goal */
  suggestedGoalName: string | null;
  /** All goals linked to the destination account */
  linkedGoals: DetectedSavingsGoal[];
  /** Confidence level of the suggestion */
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Human-readable reason for the suggestion */
  reason: string;
  /** Whether the destination account is a savings account */
  isSavingsAccount: boolean;
}

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
  // Get the destination account to check its type
  const [destinationAccount] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, destinationAccountId),
        eq(accounts.householdId, householdId)
      )
    );

  if (!destinationAccount) {
    return {
      suggestedGoalId: null,
      suggestedGoalName: null,
      linkedGoals: [],
      confidence: 'none',
      reason: 'Destination account not found',
      isSavingsAccount: false,
    };
  }

  const isSavingsAccount = destinationAccount.type === 'savings';

  // Query all active goals linked to this account
  const linkedGoals = await db
    .select({
      id: savingsGoals.id,
      name: savingsGoals.name,
      targetAmount: savingsGoals.targetAmount,
      currentAmount: savingsGoals.currentAmount,
      color: savingsGoals.color,
      accountId: savingsGoals.accountId,
    })
    .from(savingsGoals)
    .where(
      and(
        eq(savingsGoals.accountId, destinationAccountId),
        eq(savingsGoals.householdId, householdId),
        eq(savingsGoals.status, 'active')
      )
    );

  // Map to DetectedSavingsGoal type
  const mappedGoals: DetectedSavingsGoal[] = linkedGoals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount || 0,
    color: goal.color || '#10b981',
    accountId: goal.accountId,
  }));

  // Determine confidence level and suggestion
  if (mappedGoals.length === 1) {
    // Exactly one goal linked - high confidence, auto-select
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
    // Multiple goals linked - medium confidence, let user choose
    return {
      suggestedGoalId: null, // Don't auto-select when multiple
      suggestedGoalName: null,
      linkedGoals: mappedGoals,
      confidence: 'medium',
      reason: `${mappedGoals.length} goals are linked to this account. Select one to track your progress.`,
      isSavingsAccount,
    };
  }

  // No goals linked to this account
  if (isSavingsAccount) {
    // It's a savings account but no goals - low confidence, suggest creating one
    return {
      suggestedGoalId: null,
      suggestedGoalName: null,
      linkedGoals: [],
      confidence: 'low',
      reason: `Consider linking a savings goal to "${destinationAccount.name}" to track your progress`,
      isSavingsAccount: true,
    };
  }

  // Not a savings account and no linked goals - no suggestion
  return {
    suggestedGoalId: null,
    suggestedGoalName: null,
    linkedGoals: [],
    confidence: 'none',
    reason: '',
    isSavingsAccount: false,
  };
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
  const goals = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(
      and(
        eq(savingsGoals.accountId, accountId),
        eq(savingsGoals.householdId, householdId),
        eq(savingsGoals.status, 'active')
      )
    )
    .limit(1);

  return goals.length > 0;
}

