import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtPayments, debtPayoffMilestones } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    let householdId: string;
    try {
      const result = await getAndVerifyHousehold(request, userId);
      householdId = result.householdId;
    } catch (error) {
      // If household verification fails, return 404 to prevent enumeration
      if (error instanceof Error && (error.message.includes('Household ID') || error.message.includes('Not a member'))) {
        return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
      }
      throw error;
    }
    const { id } = await params;
    const debt = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.id, id),
          eq(debts.userId, userId),
          eq(debts.householdId, householdId)
        )
      )
      .then((res) => res[0]);

    if (!debt) {
      return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
    }

    const payments = await db
      .select()
      .from(debtPayments)
      .where(
        and(
          eq(debtPayments.debtId, id),
          eq(debtPayments.householdId, householdId)
        )
      )
      .orderBy(debtPayments.paymentDate);

    const milestones = await db
      .select()
      .from(debtPayoffMilestones)
      .where(
        and(
          eq(debtPayoffMilestones.debtId, id),
          eq(debtPayoffMilestones.householdId, householdId)
        )
      )
      .orderBy(debtPayoffMilestones.percentage);

    return new Response(JSON.stringify({ ...debt, payments, milestones }), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
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
    const body = await request.json();
    let householdId: string;
    try {
      const result = await getAndVerifyHousehold(request, userId, body);
      householdId = result.householdId;
    } catch (error) {
      // If household verification fails, return 404 to prevent enumeration
      if (error instanceof Error && (error.message.includes('Household ID') || error.message.includes('Not a member'))) {
        return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
      }
      throw error;
    }
    const { id } = await params;

    // Verify user owns this debt and it belongs to household
    const debt = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.id, id),
          eq(debts.userId, userId),
          eq(debts.householdId, householdId)
        )
      )
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
              eq(debtPayoffMilestones.percentage, milestone.percentage),
              eq(debtPayoffMilestones.householdId, householdId)
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
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
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
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await params;

    // Verify user owns this debt and it belongs to household
    const debt = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.id, id),
          eq(debts.userId, userId),
          eq(debts.householdId, householdId)
        )
      )
      .then((res) => res[0]);

    if (!debt) {
      return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
    }

    // Delete milestones first (with household filter for safety)
    await db
      .delete(debtPayoffMilestones)
      .where(
        and(
          eq(debtPayoffMilestones.debtId, id),
          eq(debtPayoffMilestones.householdId, householdId)
        )
      );

    // Delete payments (with household filter for safety)
    await db
      .delete(debtPayments)
      .where(
        and(
          eq(debtPayments.debtId, id),
          eq(debtPayments.householdId, householdId)
        )
      );

    // Delete debt
    await db.delete(debts).where(eq(debts.id, id));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting debt:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete debt' }), { status: 500 });
  }
}
