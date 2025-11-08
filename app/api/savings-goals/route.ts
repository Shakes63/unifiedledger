import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { savingsGoals, savingsMilestones } from '@/lib/db/schema';
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

    const conditions = [eq(savingsGoals.userId, userId)];
    if (status) {
      conditions.push(eq(savingsGoals.status, status as any));
    }

    const goals = await db
      .select()
      .from(savingsGoals)
      .where(and(...conditions))
      .orderBy(savingsGoals.priority);

    return new Response(JSON.stringify(goals), { status: 200 });
  } catch (error) {
    console.error('Error fetching savings goals:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch savings goals' }), { status: 500 });
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
      targetAmount,
      currentAmount = 0,
      accountId,
      category = 'other',
      color = '#10b981',
      icon = 'target',
      targetDate,
      status = 'active',
      priority = 0,
      monthlyContribution,
      notes,
    } = body;

    if (!name || !targetAmount) {
      return new Response(
        JSON.stringify({ error: 'Name and target amount are required' }),
        { status: 400 }
      );
    }

    const goalId = nanoid();
    const now = new Date().toISOString();

    // Insert the goal
    await db.insert(savingsGoals).values({
      id: goalId,
      userId,
      name,
      description,
      targetAmount,
      currentAmount,
      accountId,
      category,
      color,
      icon,
      targetDate,
      status,
      priority,
      monthlyContribution,
      notes,
      createdAt: now,
      updatedAt: now,
    });

    // Create milestones (25%, 50%, 75%, 100%)
    const milestones = [
      { percentage: 25, milestoneAmount: targetAmount * 0.25 },
      { percentage: 50, milestoneAmount: targetAmount * 0.5 },
      { percentage: 75, milestoneAmount: targetAmount * 0.75 },
      { percentage: 100, milestoneAmount: targetAmount },
    ];

    for (const milestone of milestones) {
      await db.insert(savingsMilestones).values({
        id: nanoid(),
        goalId,
        userId,
        percentage: milestone.percentage,
        milestoneAmount: milestone.milestoneAmount,
        createdAt: now,
      });
    }

    const goal = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.id, goalId));

    if (!goal || goal.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to retrieve created goal' }), { status: 500 });
    }

    return new Response(JSON.stringify(goal[0]), { status: 201 });
  } catch (error) {
    console.error('Error creating savings goal:', error);
    return new Response(JSON.stringify({ error: 'Failed to create savings goal' }), { status: 500 });
  }
}
