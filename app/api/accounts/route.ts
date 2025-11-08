import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(desc(accounts.usageCount), accounts.sortOrder);

    return Response.json(userAccounts);
  } catch (error) {
    console.error('Account fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      type,
      bankName,
      accountNumberLast4,
      currentBalance = 0,
      creditLimit,
      color = '#3b82f6',
      icon = 'wallet',
    } = body;

    if (!name || !type) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const accountId = nanoid();

    await db.insert(accounts).values({
      id: accountId,
      userId,
      name,
      type,
      bankName: bankName || null,
      accountNumberLast4: accountNumberLast4 || null,
      currentBalance,
      creditLimit: creditLimit || null,
      color,
      icon,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return Response.json(
      { id: accountId, message: 'Account created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Account creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
