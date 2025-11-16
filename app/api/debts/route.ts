import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtPayoffMilestones, budgetCategories, accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const conditions = [
      eq(debts.userId, userId),
      eq(debts.householdId, householdId)
    ];
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching debts:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch debts' }), { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);
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

    // Validate account belongs to household if provided
    if (accountId) {
      const account = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, accountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1)
        .then(result => result[0]);

      if (!account) {
        return Response.json(
          { error: 'Account not found or does not belong to this household' },
          { status: 400 }
        );
      }
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
        householdId,
        name: `Debt: ${name}`,
        type: 'debt',
        isActive: true,
        createdAt: now,
      });
    }

    // Insert the debt
    await db.insert(debts).values({
      id: debtId,
      userId,
      householdId,
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
        householdId,
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating debt:', error);
    return new Response(JSON.stringify({ error: 'Failed to create debt' }), { status: 500 });
  }
}
