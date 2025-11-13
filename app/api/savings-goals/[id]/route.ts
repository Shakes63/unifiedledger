import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { savingsGoals, savingsMilestones } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const goal = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .then((res) => res[0]);

    if (!goal) {
      return new Response(JSON.stringify({ error: 'Goal not found' }), { status: 404 });
    }

    const milestones = await db
      .select()
      .from(savingsMilestones)
      .where(eq(savingsMilestones.goalId, id))
      .orderBy(savingsMilestones.percentage);

    return new Response(JSON.stringify({ ...goal, milestones }), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching savings goal:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch savings goal' }), { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Verify user owns this goal
    const goal = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .then((res) => res[0]);

    if (!goal) {
      return new Response(JSON.stringify({ error: 'Goal not found' }), { status: 404 });
    }

    const updates: any = { ...body };
    updates.updatedAt = new Date().toISOString();

    // If targetAmount changed, recalculate milestone amounts
    if (body.targetAmount && body.targetAmount !== goal.targetAmount) {
      const newTargetAmount = body.targetAmount;

      // Update milestones with new amounts
      const milestones = [
        { percentage: 25, milestoneAmount: newTargetAmount * 0.25 },
        { percentage: 50, milestoneAmount: newTargetAmount * 0.5 },
        { percentage: 75, milestoneAmount: newTargetAmount * 0.75 },
        { percentage: 100, milestoneAmount: newTargetAmount },
      ];

      for (const milestone of milestones) {
        const existingMilestone = await db
          .select()
          .from(savingsMilestones)
          .where(
            and(
              eq(savingsMilestones.goalId, id),
              eq(savingsMilestones.percentage, milestone.percentage)
            )
          )
          .then((res) => res[0]);

        if (existingMilestone && !existingMilestone.achievedAt) {
          await db
            .update(savingsMilestones)
            .set({ milestoneAmount: milestone.milestoneAmount })
            .where(eq(savingsMilestones.id, existingMilestone.id));
        }
      }
    }

    await db
      .update(savingsGoals)
      .set(updates)
      .where(eq(savingsGoals.id, id));

    const updatedGoal = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.id, id))
      .then((res) => res[0]);

    return new Response(JSON.stringify(updatedGoal), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating savings goal:', error);
    return new Response(JSON.stringify({ error: 'Failed to update savings goal' }), { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    // Verify user owns this goal
    const goal = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .then((res) => res[0]);

    if (!goal) {
      return new Response(JSON.stringify({ error: 'Goal not found' }), { status: 404 });
    }

    // Delete milestones first
    await db.delete(savingsMilestones).where(eq(savingsMilestones.goalId, id));

    // Delete goal
    await db.delete(savingsGoals).where(eq(savingsGoals.id, id));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting savings goal:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete savings goal' }), { status: 500 });
  }
}
