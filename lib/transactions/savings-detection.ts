/**
 * Savings-goal detection for transfers (queries, scoring, result shaping).
 *
 * Consolidated from single-use shim files during the post-audit cleanup;
 * behavior is unchanged.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, savingsGoals } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// from savings-detection-types.ts
// ---------------------------------------------------------------------------
interface DetectedSavingsGoal {
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

// ---------------------------------------------------------------------------
// from savings-detection-queries.ts
// ---------------------------------------------------------------------------
async function getDestinationAccount({
  destinationAccountId,
  householdId,
}: {
  destinationAccountId: string;
  householdId: string;
}): Promise<{
  id: string;
  name: string;
  type: string;
} | null> {
  const [destinationAccount] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
    })
    .from(accounts)
    .where(
      and(eq(accounts.id, destinationAccountId), eq(accounts.householdId, householdId))
    );

  return destinationAccount ?? null;
}

async function getActiveGoalsForAccount({
  accountId,
  householdId,
}: {
  accountId: string;
  householdId: string;
}): Promise<
  Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number | null;
    color: string | null;
    accountId: string | null;
  }>
> {
  return db
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
        eq(savingsGoals.accountId, accountId),
        eq(savingsGoals.householdId, householdId),
        eq(savingsGoals.status, 'active')
      )
    );
}

async function hasAnyActiveGoalsForAccount({
  accountId,
  householdId,
}: {
  accountId: string;
  householdId: string;
}): Promise<boolean> {
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

// ---------------------------------------------------------------------------
// from savings-detection-result.ts
// ---------------------------------------------------------------------------
const DEFAULT_GOAL_COLOR = '#10b981';

function mapDetectedGoals(
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

function buildSavingsDetectionResult({
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

function buildMissingDestinationAccountResult(): SavingsDetectionResult {
  return {
    suggestedGoalId: null,
    suggestedGoalName: null,
    linkedGoals: [],
    confidence: 'none',
    reason: 'Destination account not found',
    isSavingsAccount: false,
  };
}

// ---------------------------------------------------------------------------
// from savings-detection.ts
// ---------------------------------------------------------------------------
export type { DetectedSavingsGoal };

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
