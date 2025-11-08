import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

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
      accountId,
      categoryId,
      date,
      amount,
      description,
      notes,
      type = 'expense',
      isPending = false,
    } = body;

    // Validate required fields
    if (!accountId || !date || !amount || !description) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate account belongs to user
    const account = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId)
        )
      )
      .limit(1);

    if (account.length === 0) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Validate category if provided
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Create transaction
    const transactionId = nanoid();
    const decimalAmount = new Decimal(amount);

    const result = await db.insert(transactions).values({
      id: transactionId,
      userId,
      accountId,
      categoryId: categoryId || null,
      date,
      amount: decimalAmount.toNumber(),
      description,
      notes: notes || null,
      type,
      isPending,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update account balance
    const newBalance = new Decimal(account[0].currentBalance || 0);
    const updatedBalance =
      type === 'expense' || type === 'transfer_out'
        ? newBalance.minus(decimalAmount)
        : newBalance.plus(decimalAmount);

    await db
      .update(accounts)
      .set({
        currentBalance: updatedBalance.toNumber(),
        lastUsedAt: new Date().toISOString(),
        usageCount: (account[0].usageCount || 0) + 1,
      })
      .where(eq(accounts.id, accountId));

    return Response.json(
      {
        id: transactionId,
        message: 'Transaction created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Transaction creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(transactions.date)
      .limit(limit)
      .offset(offset);

    return Response.json(userTransactions);
  } catch (error) {
    console.error('Transaction fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
