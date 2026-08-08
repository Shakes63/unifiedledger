/**
 * Bug-hunt findings on the savings-goal contribution path:
 * - A1/A3: the read-modify-write and the contribution INSERT were separate
 *   autocommits, so the goal total and its contribution rows could disagree.
 * - M4: milestone crossing was compared as float percentages, so a target whose
 *   75% is not exactly representable (e.g. $1000.08) never fired that milestone.
 * - M5: the inline notification left notificationSentAt NULL, so the milestone
 *   cron sent a second notification for the same event.
 * - Product decision: a cancelled goal is closed to new contributions.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { savingsGoalContributions, savingsGoals, savingsMilestones } from '@/lib/db/schema';
import { handleGoalContribution } from '@/lib/goals/contribution-handler';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

describe('goal contribution integrity', () => {
  let ctx: { userId: string; householdId: string } | null = null;

  afterEach(async () => {
    if (ctx) {
      await db
        .delete(savingsGoalContributions)
        .where(eq(savingsGoalContributions.householdId, ctx.householdId));
      await db.delete(savingsMilestones).where(eq(savingsMilestones.householdId, ctx.householdId));
      await db.delete(savingsGoals).where(eq(savingsGoals.householdId, ctx.householdId));
      await cleanupTestHousehold(ctx.userId, ctx.householdId);
      ctx = null;
    }
  });

  async function makeGoal(overrides: Partial<typeof savingsGoals.$inferInsert> = {}) {
    ctx = ctx ?? (await setupTestUserWithHousehold());
    const goalId = nanoid();
    await db.insert(savingsGoals).values({
      id: goalId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Test Goal',
      targetAmount: 1000,
      targetAmountCents: 100000,
      currentAmount: 0,
      currentAmountCents: 0,
      status: 'active',
      ...overrides,
    } as typeof savingsGoals.$inferInsert);
    return goalId;
  }

  it('A1/A3: the goal total always equals the sum of its contribution rows', async () => {
    ctx = await setupTestUserWithHousehold();
    const goalId = await makeGoal();

    for (const amount of [100, 250.55, 12.01]) {
      await handleGoalContribution(goalId, amount, nanoid(), ctx.userId, ctx.householdId);
    }

    const [goal] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, goalId));
    const rows = await db
      .select()
      .from(savingsGoalContributions)
      .where(eq(savingsGoalContributions.goalId, goalId));

    const summed = rows.reduce((total, row) => total + (row.amountCents ?? 0), 0);
    expect(rows).toHaveLength(3);
    expect(goal.currentAmountCents).toBe(36256); // 10000 + 25055 + 1201
    expect(summed).toBe(goal.currentAmountCents);
  });

  it('M4: fires the 75% milestone at exactly 75% of an awkward target', async () => {
    ctx = await setupTestUserWithHousehold();
    // 75% of $1000.08 is $750.06, which is not exactly representable as a float
    // percentage — the old comparison computed 74.99999999999999.
    const goalId = await makeGoal({ targetAmount: 1000.08, targetAmountCents: 100008 });

    const result = await handleGoalContribution(
      goalId,
      750.06,
      nanoid(),
      ctx.userId,
      ctx.householdId
    );

    expect(result.success).toBe(true);
    expect(result.milestonesAchieved).toContain(75);
    expect(result.milestonesAchieved).toContain(25);
    expect(result.milestonesAchieved).toContain(50);
    expect(result.milestonesAchieved).not.toContain(100);
  });

  it('M5: an inline-notified milestone is stamped so the cron will not resend', async () => {
    ctx = await setupTestUserWithHousehold();
    const goalId = await makeGoal();

    await handleGoalContribution(goalId, 500, nanoid(), ctx.userId, ctx.householdId);

    const [fifty] = await db
      .select()
      .from(savingsMilestones)
      .where(
        and(eq(savingsMilestones.goalId, goalId), eq(savingsMilestones.percentage, 50))
      );
    expect(fifty).toBeTruthy();
    expect(fifty.achievedAt).toBeTruthy();
    // The cron selects milestones with achievedAt set and notificationSentAt NULL.
    expect(fifty.notificationSentAt).toBeTruthy();
  });

  it('rejects contributions to a cancelled goal, leaving the total untouched', async () => {
    ctx = await setupTestUserWithHousehold();
    const goalId = await makeGoal({ status: 'cancelled', currentAmount: 50, currentAmountCents: 5000 });

    const result = await handleGoalContribution(
      goalId,
      100,
      nanoid(),
      ctx.userId,
      ctx.householdId
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cancelled/i);

    const [goal] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, goalId));
    expect(goal.currentAmountCents).toBe(5000);
    const rows = await db
      .select()
      .from(savingsGoalContributions)
      .where(eq(savingsGoalContributions.goalId, goalId));
    expect(rows).toHaveLength(0);
  });

  it('still accepts contributions to paused and completed goals', async () => {
    ctx = await setupTestUserWithHousehold();
    for (const status of ['paused', 'completed'] as const) {
      const goalId = await makeGoal({ status });
      const result = await handleGoalContribution(
        goalId,
        25,
        nanoid(),
        ctx.userId,
        ctx.householdId
      );
      expect(result.success).toBe(true);
    }
  });

  it('a zero target cannot divide by zero in the milestone check', async () => {
    ctx = await setupTestUserWithHousehold();
    const goalId = await makeGoal({ targetAmount: 0, targetAmountCents: 0 });

    const result = await handleGoalContribution(goalId, 50, nanoid(), ctx.userId, ctx.householdId);

    expect(result.success).toBe(true);
    expect(result.milestonesAchieved).toEqual([]);
  });
});
