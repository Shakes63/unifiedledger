import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { savingsGoals, savingsMilestones } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.error('[Savings Goals GET] No userId from auth');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    console.log('[Savings Goals GET] Fetching goals for user:', userId, 'status:', status);

    const conditions = [eq(savingsGoals.userId, userId)];
    if (status) {
      conditions.push(eq(savingsGoals.status, status as any));
    }

    const goals = await db
      .select()
      .from(savingsGoals)
      .where(and(...conditions))
      .orderBy(savingsGoals.priority);

    console.log('[Savings Goals GET] Found', goals.length, 'goals');
    return new Response(JSON.stringify(goals), { status: 200 });
  } catch (error) {
    console.error('[Savings Goals GET] Error:', error);
    // Log the full error details
    if (error instanceof Error) {
      console.error('[Savings Goals GET] Error message:', error.message);
      console.error('[Savings Goals GET] Error stack:', error.stack);
    }
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch savings goals',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.error('[Savings Goals POST] No userId from auth');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await request.json();
    console.log('[Savings Goals POST] Request body:', JSON.stringify(body).substring(0, 200));

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
      console.error('[Savings Goals POST] Missing required fields:', { name, targetAmount });
      return new Response(
        JSON.stringify({ error: 'Name and target amount are required' }),
        { status: 400 }
      );
    }

    const goalId = nanoid();
    const now = new Date().toISOString();

    console.log('[Savings Goals POST] Creating goal with ID:', goalId);

    // Insert the goal
    await db.insert(savingsGoals).values({
      id: goalId,
      userId,
      name,
      description,
      targetAmount: parseFloat(String(targetAmount)),
      currentAmount: parseFloat(String(currentAmount)),
      accountId,
      category,
      color,
      icon,
      targetDate,
      status,
      priority,
      monthlyContribution: monthlyContribution ? parseFloat(String(monthlyContribution)) : null,
      notes,
      createdAt: now,
      updatedAt: now,
    });

    console.log('[Savings Goals POST] Goal created, creating milestones');

    // Create milestones (25%, 50%, 75%, 100%)
    const targetAmountNum = parseFloat(String(targetAmount));
    const milestones = [
      { percentage: 25, milestoneAmount: targetAmountNum * 0.25 },
      { percentage: 50, milestoneAmount: targetAmountNum * 0.5 },
      { percentage: 75, milestoneAmount: targetAmountNum * 0.75 },
      { percentage: 100, milestoneAmount: targetAmountNum },
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

    console.log('[Savings Goals POST] Milestones created, fetching goal');

    const goal = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.id, goalId));

    if (!goal || goal.length === 0) {
      console.error('[Savings Goals POST] Failed to retrieve created goal');
      return new Response(JSON.stringify({ error: 'Failed to retrieve created goal' }), { status: 500 });
    }

    console.log('[Savings Goals POST] Success, returning goal');
    return new Response(JSON.stringify(goal[0]), { status: 201 });
  } catch (error) {
    console.error('[Savings Goals POST] Error:', error);
    // Log the full error details
    if (error instanceof Error) {
      console.error('[Savings Goals POST] Error message:', error.message);
      console.error('[Savings Goals POST] Error stack:', error.stack);
    }
    return new Response(
      JSON.stringify({
        error: 'Failed to create savings goal',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    );
  }
}
