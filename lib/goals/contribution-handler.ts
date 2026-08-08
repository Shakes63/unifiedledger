import { db } from '@/lib/db';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { savingsGoals, savingsMilestones, savingsGoalContributions, notifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import { buildGoalCurrentFields, getGoalCurrentCents } from '@/lib/goals/goal-money';
import { fromMoneyCents, toMoneyCents } from '@/lib/utils/money-cents';

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
    // Validate the contribution amount (M-DBG-12): NaN/Infinity/negative values
    // previously flowed straight into the goal total.
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        success: false,
        goalId,
        previousAmount: 0,
        newAmount: 0,
        contribution: amount,
        milestonesAchieved: [],
        error: 'Contribution amount must be a positive number',
      };
    }

    // The read, the goal UPDATE and the contribution INSERT are ONE unit
    // (findings A1/A3). Previously each statement autocommitted on its own, so
    // (a) two concurrent contributions both read the same starting balance and
    // the second overwrote the first — proven to lose money — and (b) a crash
    // between the update and the insert left the goal credited with no
    // contribution row, which the reversal path can never undo.
    // runInDatabaseTransaction serializes on BEGIN IMMEDIATE and nested calls
    // join the caller's transaction, so this composes with the transaction
    // create/update orchestrators.
    return await runInDatabaseTransaction(async (tx) => {
      // Re-read INSIDE the transaction: a goal fetched before BEGIN is exactly
      // the stale read that caused the lost update.
      const [goal] = await tx
        .select()
        .from(savingsGoals)
        .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.householdId, householdId)));

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

      // A cancelled goal is closed to new money (product decision). Paused and
      // completed goals still accept contributions.
      if (goal.status === 'cancelled') {
        return {
          success: false,
          goalId,
          previousAmount: 0,
          newAmount: 0,
          contribution: amount,
          milestonesAchieved: [],
          error: 'Goal is cancelled and cannot receive contributions',
        };
      }

      // Work in integer cents so the goal total can't drift (RC-4).
      const previousCents = getGoalCurrentCents(goal);
      const contributionCents = toMoneyCents(amount) ?? 0;
      const newCents = previousCents + contributionCents;
      const previousAmount = new Decimal(fromMoneyCents(previousCents) ?? 0);
      const newAmount = new Decimal(fromMoneyCents(newCents) ?? 0);

      // Update the goal's current amount (cents authoritative, float derived)
      await tx
        .update(savingsGoals)
        .set({
          ...buildGoalCurrentFields(newCents),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(savingsGoals.id, goalId));

      // Record the contribution
      await tx.insert(savingsGoalContributions).values({
        id: uuidv4(),
        transactionId,
        goalId,
        userId,
        householdId,
        amount: fromMoneyCents(contributionCents) ?? 0,
        amountCents: contributionCents,
        createdAt: new Date().toISOString(),
      });

      // Check for milestone achievements
      const milestonesAchieved = await checkMilestones(
        goalId,
        previousAmount.toNumber(),
        newAmount.toNumber(),
        goal.targetAmount,
        userId,
        householdId,
        tx
      );

      return {
        success: true,
        goalId,
        previousAmount: previousAmount.toNumber(),
        newAmount: newAmount.toNumber(),
        contribution: amount,
        milestonesAchieved,
      };
    });
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
 * Goal contributions can never exceed the transaction funding them (M-DBG-12).
 *
 * This lived inline in the non-transfer create branch only, so the transfer
 * branch credited whatever the payload asked for: a $10 transfer carrying a
 * $10,000 contribution credited the goal $10,000, fired every milestone, and
 * fed a fabricated $10,000 into the savings-rate report. One shared oracle so
 * the two branches can't drift apart again.
 *
 * The half-cent tolerance absorbs float representation of the incoming amount.
 */
export function contributionsExceedTransaction(
  contributions: GoalContribution[],
  transactionAmount: number
): boolean {
  // Per-entry check first: a sum-only guard was bypassable with a negative
  // offsetting entry (finding A6). `[{g1: 10000}, {g2: -9995}]` against a $10
  // transaction sums to 5 and passed, then handleGoalContribution rejected the
  // negative row individually while crediting g1 the full $10,000.
  const hasInvalidEntry = contributions.some((contribution) => {
    const value = Number(contribution.amount);
    return !Number.isFinite(value) || value <= 0;
  });
  if (hasInvalidEntry) return true;

  const totalRequested = contributions.reduce(
    (sum, contribution) => sum + Number(contribution.amount),
    0
  );
  return totalRequested > Math.abs(transactionAmount) + 0.005;
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

    // Calculate new amount in integer cents (RC-4)
    const currentCents = getGoalCurrentCents(goal);
    const revertCents =
      contribution.amountCents !== null && contribution.amountCents !== undefined
        ? Number(contribution.amountCents)
        : toMoneyCents(contribution.amount) ?? 0;
    const newCents = Math.max(0, currentCents - revertCents);

    // Update the goal's current amount (cents authoritative, float derived)
    await db
      .update(savingsGoals)
      .set({
        ...buildGoalCurrentFields(newCents),
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
  householdId: string,
  client: typeof db = db
): Promise<number[]> {
  const milestonePercentages = [25, 50, 75, 100];
  const achieved: number[] = [];

  // A zero or negative target has no meaningful percentage; bail rather than
  // dividing by zero (NaN/Infinity silently fail every comparison below).
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return achieved;
  }

  // Compare in INTEGER CENTS, not float percentages (finding M4). `target * 0.75`
  // is not exact in binary: for a $1000.08 goal, saving exactly $750.06 gave
  // 74.99999999999999 >= 75 === false, so the 75% milestone never fired and the
  // badge was unreachable. Cross-multiplying in cents makes the boundary exact.
  const targetCents = toMoneyCents(targetAmount) ?? 0;
  const previousCents = toMoneyCents(previousAmount) ?? 0;
  const newCents = toMoneyCents(newAmount) ?? 0;

  for (const percentage of milestonePercentages) {
    const milestoneAmount = (targetAmount * percentage) / 100;
    // previous < threshold <= new, as integers: x*100 vs targetCents*percentage
    const crossed =
      previousCents * 100 < targetCents * percentage &&
      newCents * 100 >= targetCents * percentage;

    // Check if we crossed this milestone
    if (crossed) {
      // Check if milestone already exists
      const existingMilestones = await client
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
        await client
          .update(savingsMilestones)
          .set({
            achievedAt: new Date().toISOString(),
            // Stamp notificationSentAt here (finding M5): this path creates the
            // notification inline, but left the column NULL, so the milestone
            // cron re-selected the same milestone and sent a SECOND identical
            // notification for one event.
            notificationSentAt: new Date().toISOString(),
          })
          .where(eq(savingsMilestones.id, existingMilestone.id));
        achieved.push(percentage);
      } else if (!existingMilestone) {
        // Create new milestone
        await client.insert(savingsMilestones).values({
          id: uuidv4(),
          goalId,
          userId,
          householdId,
          percentage,
          milestoneAmount,
          achievedAt: new Date().toISOString(),
          notificationSentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
        achieved.push(percentage);
      }

      // Create notification for milestone
      if (achieved.includes(percentage)) {
        const [goal] = await client
          .select()
          .from(savingsGoals)
          .where(eq(savingsGoals.id, goalId));

        if (goal) {
          await client.insert(notifications).values({
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

