import { db } from '@/lib/db';
import { savingsGoals, savingsMilestones, savingsGoalContributions, notifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';

interface ContributionResult {
  success: boolean;
  goalId: string;
  previousAmount: number;
  newAmount: number;
  contribution: number;
  milestonesAchieved: number[];
  error?: string;
}

interface GoalContribution {
  goalId: string;
  amount: number;
}

/**
 * Handle a contribution to a savings goal
 * Updates the goal's currentAmount and checks for milestone achievements
 */
export async function handleGoalContribution(
  goalId: string,
  amount: number,
  transactionId: string,
  userId: string,
  householdId: string
): Promise<ContributionResult> {
  try {
    // Get the current goal
    const [goal] = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.id, goalId));

    if (!goal) {
      return {
        success: false,
        goalId,
        previousAmount: 0,
        newAmount: 0,
        contribution: amount,
        milestonesAchieved: [],
        error: 'Goal not found',
      };
    }

    // Calculate new amount using Decimal.js for precision
    const previousAmount = new Decimal(goal.currentAmount || 0);
    const contributionAmount = new Decimal(amount);
    const newAmount = previousAmount.plus(contributionAmount);

    // Update the goal's current amount
    await db
      .update(savingsGoals)
      .set({
        currentAmount: newAmount.toNumber(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(savingsGoals.id, goalId));

    // Record the contribution
    await db.insert(savingsGoalContributions).values({
      id: uuidv4(),
      transactionId,
      goalId,
      userId,
      householdId,
      amount,
      createdAt: new Date().toISOString(),
    });

    // Check for milestone achievements
    const milestonesAchieved = await checkMilestones(
      goalId,
      previousAmount.toNumber(),
      newAmount.toNumber(),
      goal.targetAmount,
      userId,
      householdId
    );

    return {
      success: true,
      goalId,
      previousAmount: previousAmount.toNumber(),
      newAmount: newAmount.toNumber(),
      contribution: amount,
      milestonesAchieved,
    };
  } catch (error) {
    console.error('Error handling goal contribution:', error);
    return {
      success: false,
      goalId,
      previousAmount: 0,
      newAmount: 0,
      contribution: amount,
      milestonesAchieved: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle multiple contributions (split across goals)
 */
export async function handleMultipleContributions(
  contributions: GoalContribution[],
  transactionId: string,
  userId: string,
  householdId: string
): Promise<ContributionResult[]> {
  const results: ContributionResult[] = [];

  for (const contribution of contributions) {
    const result = await handleGoalContribution(
      contribution.goalId,
      contribution.amount,
      transactionId,
      userId,
      householdId
    );
    results.push(result);
  }

  return results;
}

/**
 * Revert a contribution (for deleted or updated transactions)
 */
export async function revertGoalContribution(
  transactionId: string,
  goalId: string
): Promise<{ success: boolean; amountReverted: number; error?: string }> {
  try {
    // Find the contribution record
    const [contribution] = await db
      .select()
      .from(savingsGoalContributions)
      .where(
        and(
          eq(savingsGoalContributions.transactionId, transactionId),
          eq(savingsGoalContributions.goalId, goalId)
        )
      );

    if (!contribution) {
      return { success: true, amountReverted: 0 }; // No contribution to revert
    }

    // Get the current goal
    const [goal] = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.id, goalId));

    if (!goal) {
      return { success: false, amountReverted: 0, error: 'Goal not found' };
    }

    // Calculate new amount
    const currentAmount = new Decimal(goal.currentAmount || 0);
    const revertAmount = new Decimal(contribution.amount);
    const newAmount = currentAmount.minus(revertAmount);

    // Update the goal's current amount (don't go below 0)
    await db
      .update(savingsGoals)
      .set({
        currentAmount: Math.max(0, newAmount.toNumber()),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(savingsGoals.id, goalId));

    // Delete the contribution record
    await db
      .delete(savingsGoalContributions)
      .where(eq(savingsGoalContributions.id, contribution.id));

    // Note: We don't revert milestones - they stay achieved even if amount decreases

    return { success: true, amountReverted: contribution.amount };
  } catch (error) {
    console.error('Error reverting goal contribution:', error);
    return {
      success: false,
      amountReverted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Revert all contributions from a transaction
 */
export async function revertAllContributions(
  transactionId: string
): Promise<{ success: boolean; totalReverted: number }> {
  try {
    // Find all contributions for this transaction
    const contributionsToRevert = await db
      .select()
      .from(savingsGoalContributions)
      .where(eq(savingsGoalContributions.transactionId, transactionId));

    let totalReverted = 0;

    for (const contribution of contributionsToRevert) {
      const result = await revertGoalContribution(transactionId, contribution.goalId);
      if (result.success) {
        totalReverted += result.amountReverted;
      }
    }

    return { success: true, totalReverted };
  } catch (error) {
    console.error('Error reverting all contributions:', error);
    return { success: false, totalReverted: 0 };
  }
}

/**
 * Check and create milestones for a goal
 */
async function checkMilestones(
  goalId: string,
  previousAmount: number,
  newAmount: number,
  targetAmount: number,
  userId: string,
  householdId: string
): Promise<number[]> {
  const milestonePercentages = [25, 50, 75, 100];
  const achieved: number[] = [];

  for (const percentage of milestonePercentages) {
    const milestoneAmount = (targetAmount * percentage) / 100;
    const previousPercentage = (previousAmount / targetAmount) * 100;
    const newPercentage = (newAmount / targetAmount) * 100;

    // Check if we crossed this milestone
    if (previousPercentage < percentage && newPercentage >= percentage) {
      // Check if milestone already exists
      const existingMilestones = await db
        .select()
        .from(savingsMilestones)
        .where(
          and(
            eq(savingsMilestones.goalId, goalId),
            eq(savingsMilestones.percentage, percentage)
          )
        );

      const existingMilestone = existingMilestones[0];

      if (existingMilestone && !existingMilestone.achievedAt) {
        // Update existing milestone
        await db
          .update(savingsMilestones)
          .set({
            achievedAt: new Date().toISOString(),
          })
          .where(eq(savingsMilestones.id, existingMilestone.id));
        achieved.push(percentage);
      } else if (!existingMilestone) {
        // Create new milestone
        await db.insert(savingsMilestones).values({
          id: uuidv4(),
          goalId,
          userId,
          householdId,
          percentage,
          milestoneAmount,
          achievedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
        achieved.push(percentage);
      }

      // Create notification for milestone
      if (achieved.includes(percentage)) {
        const [goal] = await db
          .select()
          .from(savingsGoals)
          .where(eq(savingsGoals.id, goalId));

        if (goal) {
          await db.insert(notifications).values({
            id: uuidv4(),
            userId,
            householdId,
            type: 'savings_milestone',
            title: `${percentage}% Milestone Reached!`,
            message: `Congratulations! You've reached ${percentage}% of your "${goal.name}" goal. ${
              percentage === 100
                ? 'You did it!'
                : `Keep going - you're ${100 - percentage}% away from your target!`
            }`,
            priority: percentage === 100 ? 'high' : 'normal',
            isRead: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  return achieved;
}

/**
 * Get contribution history for a goal
 */
export async function getGoalContributions(
  goalId: string,
  limit: number = 50,
  offset: number = 0
) {
  const contributionsList = await db
    .select()
    .from(savingsGoalContributions)
    .where(eq(savingsGoalContributions.goalId, goalId))
    .orderBy(savingsGoalContributions.createdAt)
    .limit(limit)
    .offset(offset);

  return contributionsList;
}

/**
 * Get total contributions for a goal
 */
export async function getTotalContributions(goalId: string): Promise<number> {
  const contributions = await db
    .select()
    .from(savingsGoalContributions)
    .where(eq(savingsGoalContributions.goalId, goalId));

  return contributions.reduce((sum, c) => sum + c.amount, 0);
}

