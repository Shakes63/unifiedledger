import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { savingsGoals, savingsMilestones, savingsGoalContributions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildGoalCurrentFields, getGoalCurrentCents } from '@/lib/goals/goal-money';
import { fromMoneyCents, toMoneyCents } from '@/lib/utils/money-cents';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { nanoid } from 'nanoid';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);
    const { id } = await params;
    const { currentAmount, increment } = body;

    // Validate the inputs are finite numbers (M-DBG-11): previously a string or
    // NaN was written straight into the goal amount.
    if (currentAmount !== undefined && !Number.isFinite(Number(currentAmount))) {
      return new Response(JSON.stringify({ error: 'Invalid currentAmount' }), { status: 400 });
    }
    if (increment !== undefined && !Number.isFinite(Number(increment))) {
      return new Response(JSON.stringify({ error: 'Invalid increment' }), { status: 400 });
    }

    const now = new Date().toISOString();

    // Goal read, amount write, contribution row, milestones and the status flip
    // are ONE unit (A2). They used to be five separate autocommits reading a goal
    // fetched before any of them, so two concurrent "+$X" taps both read the same
    // balance and the second overwrote the first.
    const txResult = await runInDatabaseTransaction(async (tx) => {
      const goal = await tx
        .select()
        .from(savingsGoals)
        .where(
          and(
            eq(savingsGoals.id, id),
            eq(savingsGoals.householdId, householdId)
          )
        )
        .then((res) => res[0]);

      if (!goal) {
        return { error: 'Goal not found', status: 404 as const };
      }

      // A cancelled goal is closed to new money (product decision).
      if (goal.status === 'cancelled' && increment !== undefined) {
        return { error: 'Goal is cancelled and cannot receive contributions', status: 409 as const };
      }

      // Compute in integer cents (RC-4), clamped at zero.
      const previousCents = getGoalCurrentCents(goal);
      const newCents =
        currentAmount !== undefined
          ? Math.max(0, toMoneyCents(Number(currentAmount)) ?? 0)
          : Math.max(0, previousCents + (toMoneyCents(Number(increment) || 0) ?? 0));

      // Update goal amount (cents authoritative, float derived)
      const goalFields = buildGoalCurrentFields(newCents);
      const newAmount = goalFields.currentAmount;
      await tx
        .update(savingsGoals)
        .set({ ...goalFields, updatedAt: now })
        .where(eq(savingsGoals.id, id));

      // Record the contribution (A2/P8). This route moved the goal total with no
      // audit row at all: the history panel stayed empty, the savings-rate report
      // (which sums contribution rows) reported $0 saved, and the increment was
      // unreversible because reversal is driven entirely by contribution rows.
      // transactionId is null — a manual contribution has no transaction behind
      // it, which is why migration 0021 made that column nullable.
      const deltaCents = newCents - previousCents;
      if (deltaCents > 0) {
        await tx.insert(savingsGoalContributions).values({
          id: nanoid(),
          transactionId: null,
          goalId: id,
          userId,
          householdId,
          amount: fromMoneyCents(deltaCents) ?? 0,
          amountCents: deltaCents,
          createdAt: now,
        });
      }

      // Check and mark milestones as achieved (filtered by household)
      const milestones = await tx
        .select()
        .from(savingsMilestones)
        .where(
          and(
            eq(savingsMilestones.goalId, id),
            eq(savingsMilestones.householdId, householdId)
          )
        );

      for (const milestone of milestones) {
        if (!milestone.achievedAt && newAmount >= milestone.milestoneAmount) {
          await tx
            .update(savingsMilestones)
            .set({ achievedAt: now })
            .where(eq(savingsMilestones.id, milestone.id));
        }
      }

      // Status follows the balance in BOTH directions (A14/P3): this only ever
      // set 'completed', so a goal whose target was later raised — or whose
      // contribution was reversed — stayed "Done" forever, hidden from every
      // active-goal list with no way back short of a hand-written API call.
      if (newAmount >= goal.targetAmount && goal.status === 'active') {
        await tx
          .update(savingsGoals)
          .set({ status: 'completed', updatedAt: now })
          .where(eq(savingsGoals.id, id));
      } else if (newAmount < goal.targetAmount && goal.status === 'completed') {
        await tx
          .update(savingsGoals)
          .set({ status: 'active', updatedAt: now })
          .where(eq(savingsGoals.id, id));
      }

      return { error: null };
    });

    if (txResult.error) {
      return new Response(JSON.stringify({ error: txResult.error }), { status: txResult.status });
    }

    const updatedGoal = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.id, id));

    if (!updatedGoal || updatedGoal.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to retrieve updated goal' }), { status: 500 });
    }

    const updatedMilestones = await db
      .select()
      .from(savingsMilestones)
      .where(
        and(
          eq(savingsMilestones.goalId, id),
          eq(savingsMilestones.householdId, householdId)
        )
      );

    return new Response(
      JSON.stringify({
        ...updatedGoal[0],
        milestones: updatedMilestones,
      }),
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating savings goal progress:', error);
    return new Response(JSON.stringify({ error: 'Failed to update progress' }), { status: 500 });
  }
}
