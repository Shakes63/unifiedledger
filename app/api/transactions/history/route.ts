import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, budgetCategories, accounts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

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
    const accountId = url.searchParams.get('accountId');

    // Build where conditions
    const conditions: any[] = [eq(transactions.userId, userId)];

    if (accountId) {
      conditions.push(eq(transactions.accountId, accountId));
    }

    const userTransactions = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        categoryId: transactions.categoryId,
        date: transactions.date,
        amount: transactions.amount,
        description: transactions.description,
        notes: transactions.notes,
        type: transactions.type,
        isPending: transactions.isPending,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date))
      .limit(limit)
      .offset(offset);

    return Response.json(userTransactions);
  } catch (error) {
    console.error('Transaction history fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
