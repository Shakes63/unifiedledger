import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { debts, debtPayments, debtPayoffMilestones } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
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

    const payments = await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.debtId, id))
      .orderBy(debtPayments.paymentDate);

    return new Response(JSON.stringify(payments), { status: 200 });
  } catch (error) {
    console.error('Error fetching debt payments:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch payments' }), { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { amount, paymentDate, transactionId, notes } = body;

    // Verify user owns this debt
    const debt = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .then((res) => res[0]);

    if (!debt) {
      return new Response(JSON.stringify({ error: 'Debt not found' }), { status: 404 });
    }

    if (!amount || amount <= 0 || !paymentDate) {
      return new Response(JSON.stringify({ error: 'Invalid amount or date' }), { status: 400 });
    }

    // Create payment record
    const paymentId = nanoid();
    const now = new Date().toISOString();

    await db.insert(debtPayments).values({
      id: paymentId,
      debtId: id,
      userId,
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

    // Check and mark milestones as achieved
    const milestones = await db
      .select()
      .from(debtPayoffMilestones)
      .where(eq(debtPayoffMilestones.debtId, id));

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
    console.error('Error creating debt payment:', error);
    return new Response(JSON.stringify({ error: 'Failed to record payment' }), { status: 500 });
  }
}
