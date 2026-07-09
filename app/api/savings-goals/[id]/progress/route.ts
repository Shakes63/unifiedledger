import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { savingsGoals, savingsMilestones } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildGoalCurrentFields, getGoalCurrentCents } from '@/lib/goals/goal-money';
import { toMoneyCents } from '@/lib/utils/money-cents';

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

    // Verify user owns this goal and it belongs to household
    const goal = await db
      .select()
      .from(savingsGoals)
      .where(
        and(
          eq(savingsGoals.id, id),
          eq(savingsGoals.userId, userId),
          eq(savingsGoals.householdId, householdId)
        )
      )
      .then((res) => res[0]);

    if (!goal) {
      return new Response(JSON.stringify({ error: 'Goal not found' }), { status: 404 });
    }

    // Validate the inputs are finite numbers (M-DBG-11): previously a string or
    // NaN was written straight into the goal amount.
    if (currentAmount !== undefined && !Number.isFinite(Number(currentAmount))) {
      return new Response(JSON.stringify({ error: 'Invalid currentAmount' }), { status: 400 });
    }
    if (increment !== undefined && !Number.isFinite(Number(increment))) {
      return new Response(JSON.stringify({ error: 'Invalid increment' }), { status: 400 });
    }

    // Compute in integer cents (RC-4), clamped at zero.
    const newCents =
      currentAmount !== undefined
        ? Math.max(0, toMoneyCents(Number(currentAmount)) ?? 0)
        : Math.max(0, getGoalCurrentCents(goal) + (toMoneyCents(Number(increment) || 0) ?? 0));
    const now = new Date().toISOString();

    // Update goal amount (cents authoritative, float derived)
    const goalFields = buildGoalCurrentFields(newCents);
    const newAmount = goalFields.currentAmount;
    await db
      .update(savingsGoals)
      .set({ ...goalFields, updatedAt: now })
      .where(eq(savingsGoals.id, id));

    // Check and mark milestones as achieved (filtered by household)
    const milestones = await db
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
        await db
          .update(savingsMilestones)
          .set({ achievedAt: now })
          .where(eq(savingsMilestones.id, milestone.id));
      }
    }

    // Update goal status if complete
    if (newAmount >= goal.targetAmount && goal.status === 'active') {
      await db
        .update(savingsGoals)
        .set({ status: 'completed', updatedAt: now })
        .where(eq(savingsGoals.id, id));
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
