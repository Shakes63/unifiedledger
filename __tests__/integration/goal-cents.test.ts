/**
 * RC-4: savings-goal balances are maintained in integer cents so repeated
 * contributions can't drift the stored total.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { savingsGoalContributions, savingsGoals } from '@/lib/db/schema';
import { handleGoalContribution } from '@/lib/goals/contribution-handler';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

describe('savings goal balance in integer cents (RC-4)', () => {
  let ctx: { userId: string; householdId: string } | null = null;

  afterEach(async () => {
    if (ctx) {
      await db.delete(savingsGoalContributions).where(eq(savingsGoalContributions.householdId, ctx.householdId));
      await db.delete(savingsGoals).where(eq(savingsGoals.householdId, ctx.householdId));
      await cleanupTestHousehold(ctx.userId, ctx.householdId);
      ctx = null;
    }
  });

  it('contributions accumulate exactly with no float drift', async () => {
    ctx = await setupTestUserWithHousehold();
    const goalId = nanoid();
    await db.insert(savingsGoals).values({
      id: goalId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Vacation',
      targetAmount: 1000,
      targetAmountCents: 100000,
      currentAmount: 0,
      currentAmountCents: 0,
    } as typeof savingsGoals.$inferInsert);

    // Three $33.33 contributions — the kind of values that drift under float +.
    for (let i = 0; i < 3; i++) {
      await handleGoalContribution(goalId, 33.33, nanoid(), ctx.userId, ctx.householdId);
    }

    const [goal] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, goalId));
    expect(goal.currentAmountCents).toBe(9999); // 3 * 3333, exact
    expect(goal.currentAmount).toBe(99.99);

    const contributions = await db
      .select()
      .from(savingsGoalContributions)
      .where(eq(savingsGoalContributions.goalId, goalId));
    expect(contributions).toHaveLength(3);
    expect(contributions.every((c) => c.amountCents === 3333)).toBe(true);
  });
});
