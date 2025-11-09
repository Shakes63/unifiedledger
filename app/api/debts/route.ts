import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { debts, debtPayoffMilestones, budgetCategories } from '@/lib/db/schema';
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

    const conditions = [eq(debts.userId, userId)];
    if (status) {
      conditions.push(eq(debts.status, status as any));
    }

    const debtList = await db
      .select()
      .from(debts)
      .where(and(...conditions))
      .orderBy(debts.priority);

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
      billId, // If debt has a linked bill, use bill's category instead
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
    let categoryId = null;

    // Only create category if no bill is linked
    // If bill exists, it will have its own category
    if (!billId) {
      // Create a category for this debt
      categoryId = nanoid();
      await db.insert(budgetCategories).values({
        id: categoryId,
        userId,
        name: `Debt: ${name}`,
        type: 'expense',
        icon: icon || 'credit-card',
        color: color || '#ef4444',
        isActive: true,
        sortOrder: 0,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

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
      categoryId, // Link to auto-created category (null if bill exists)
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
      .where(eq(debts.id, debtId));

    if (!debt || debt.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to retrieve created debt' }), { status: 500 });
    }

    return new Response(JSON.stringify(debt[0]), { status: 201 });
  } catch (error) {
    console.error('Error creating debt:', error);
    return new Response(JSON.stringify({ error: 'Failed to create debt' }), { status: 500 });
  }
}
