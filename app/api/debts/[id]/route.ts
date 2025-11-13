import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { debts, debtPayments, debtPayoffMilestones } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const debt = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .then((res) => res[0]);

    if (!debt) {
      return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
    }

    const payments = await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.debtId, id))
      .orderBy(debtPayments.paymentDate);

    const milestones = await db
      .select()
      .from(debtPayoffMilestones)
      .where(eq(debtPayoffMilestones.debtId, id))
      .orderBy(debtPayoffMilestones.percentage);

    return new Response(JSON.stringify({ ...debt, payments, milestones }), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching debt:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch debt' }), { status: 500 });
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

    // Verify user owns this debt
    const debt = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .then((res) => res[0]);

    if (!debt) {
      return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
    }

    const updates: any = { ...body };
    updates.updatedAt = new Date().toISOString();

    // If remaining balance changed, recalculate milestone amounts
    if (body.remainingBalance !== undefined && body.remainingBalance !== debt.remainingBalance) {
      const newBalance = body.remainingBalance;

      const milestonesToUpdate = [
        { percentage: 25, milestoneBalance: newBalance * 0.75 },
        { percentage: 50, milestoneBalance: newBalance * 0.5 },
        { percentage: 75, milestoneBalance: newBalance * 0.25 },
        { percentage: 100, milestoneBalance: 0 },
      ];

      for (const milestone of milestonesToUpdate) {
        const existing = await db
          .select()
          .from(debtPayoffMilestones)
          .where(
            and(
              eq(debtPayoffMilestones.debtId, id),
              eq(debtPayoffMilestones.percentage, milestone.percentage)
            )
          )
          .then((res) => res[0]);

        if (existing && !existing.achievedAt) {
          await db
            .update(debtPayoffMilestones)
            .set({ milestoneBalance: milestone.milestoneBalance })
            .where(eq(debtPayoffMilestones.id, existing.id));
        }
      }
    }

    await db
      .update(debts)
      .set(updates)
      .where(eq(debts.id, id));

    const updatedDebt = await db
      .select()
      .from(debts)
      .where(eq(debts.id, id))
      .then((res) => res[0]);

    return new Response(JSON.stringify(updatedDebt), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating debt:', error);
    return new Response(JSON.stringify({ error: 'Failed to update debt' }), { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    // Verify user owns this debt
    const debt = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .then((res) => res[0]);

    if (!debt) {
      return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
    }

    // Delete milestones first
    await db.delete(debtPayoffMilestones).where(eq(debtPayoffMilestones.debtId, id));

    // Delete payments
    await db.delete(debtPayments).where(eq(debtPayments.debtId, id));

    // Delete debt
    await db.delete(debts).where(eq(debts.id, id));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting debt:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete debt' }), { status: 500 });
  }
}
