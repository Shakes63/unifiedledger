import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { debts, debtPayoffMilestones } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    let query = db.select().from(debts).where(eq(debts.userId, userId));

    if (status) {
      query = query.where(eq(debts.status, status as any));
    }

    const debtList = await query.orderBy(debts.priority);

    return new Response(JSON.stringify(debtList), { status: 200 });
  } catch (error) {
    console.error('Error fetching debts:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch debts' }), { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      creditorName,
      originalAmount,
      remainingBalance,
      minimumPayment,
      interestRate = 0,
      interestType = 'none',
      accountId,
      type = 'other',
      color = '#ef4444',
      icon = 'credit-card',
      startDate,
      targetPayoffDate,
      status = 'active',
      priority = 0,
      notes,
    } = body;

    if (!name || !creditorName || !originalAmount || remainingBalance === undefined || !startDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }

    const debtId = nanoid();
    const now = new Date().toISOString();

    // Insert the debt
    await db.insert(debts).values({
      id: debtId,
      userId,
      name,
      description,
      creditorName,
      originalAmount,
      remainingBalance,
      minimumPayment,
      interestRate,
      interestType,
      accountId,
      type,
      color,
      icon,
      startDate,
      targetPayoffDate,
      status,
      priority,
      notes,
      createdAt: now,
      updatedAt: now,
    });

    // Create milestones based on remaining balance
    // Milestones are at 25%, 50%, 75%, 100% paid off (i.e., 75%, 50%, 25%, 0% remaining)
    const milestones = [
      { percentage: 25, milestoneBalance: remainingBalance * 0.75 }, // 25% paid off = 75% remaining
      { percentage: 50, milestoneBalance: remainingBalance * 0.5 },  // 50% paid off = 50% remaining
      { percentage: 75, milestoneBalance: remainingBalance * 0.25 }, // 75% paid off = 25% remaining
      { percentage: 100, milestoneBalance: 0 },                       // 100% paid off = 0% remaining
    ];

    for (const milestone of milestones) {
      await db.insert(debtPayoffMilestones).values({
        id: nanoid(),
        debtId,
        userId,
        percentage: milestone.percentage,
        milestoneBalance: milestone.milestoneBalance,
        createdAt: now,
      });
    }

    const debt = await db
      .select()
      .from(debts)
      .where(eq(debts.id, debtId))
      .then((res) => res[0]);

    return new Response(JSON.stringify(debt), { status: 201 });
  } catch (error) {
    console.error('Error creating debt:', error);
    return new Response(JSON.stringify({ error: 'Failed to create debt' }), { status: 500 });
  }
}
