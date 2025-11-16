import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtPayments, debtPayoffMilestones, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(
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

    return new Response(JSON.stringify(payments), { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching debt payments:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch payments' }), { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);
    const { id } = await params;
    const { amount, paymentDate, transactionId, notes } = body;

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

    if (!amount || amount <= 0 || !paymentDate) {
      return new Response(JSON.stringify({ error: 'Invalid amount or date' }), { status: 400 });
    }

    // Validate transaction belongs to household if provided
    if (transactionId) {
      const transaction = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, transactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        )
        .limit(1)
        .then(result => result[0]);

      if (!transaction) {
        return Response.json(
          { error: 'Transaction not found or does not belong to this household' },
          { status: 400 }
        );
      }
    }

    // Create payment record
    const paymentId = nanoid();
    const now = new Date().toISOString();

    await db.insert(debtPayments).values({
      id: paymentId,
      debtId: id,
      userId,
      householdId,
      amount,
      paymentDate,
      transactionId,
      notes,
      createdAt: now,
    });

    // Update debt's remaining balance
    const newBalance = Math.max(0, debt.remainingBalance - amount);

    await db
      .update(debts)
      .set({
        remainingBalance: newBalance,
        updatedAt: now,
        status: newBalance === 0 ? 'paid_off' : debt.status,
      })
      .where(eq(debts.id, id));

    // Check and mark milestones as achieved (filtered by household)
    const milestones = await db
      .select()
      .from(debtPayoffMilestones)
      .where(
        and(
          eq(debtPayoffMilestones.debtId, id),
          eq(debtPayoffMilestones.householdId, householdId)
        )
      );

    for (const milestone of milestones) {
      if (!milestone.achievedAt && newBalance <= milestone.milestoneBalance) {
        await db
          .update(debtPayoffMilestones)
          .set({ achievedAt: now })
          .where(eq(debtPayoffMilestones.id, milestone.id));
      }
    }

    const payment = await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.id, paymentId))
      .then((res) => res[0]);

    return new Response(JSON.stringify(payment), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating debt payment:', error);
    return new Response(JSON.stringify({ error: 'Failed to record payment' }), { status: 500 });
  }
}
