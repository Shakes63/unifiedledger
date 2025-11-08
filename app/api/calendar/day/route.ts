import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar/day
 * Get detailed transaction and bill information for a specific day
 * Query params: date (ISO string)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
      return Response.json(
        { error: 'date is required' },
        { status: 400 }
      );
    }

    const date = new Date(dateStr);
    const dateKey = format(date, 'yyyy-MM-dd');

    // Get all transactions for this day
    const dayTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.date, dateKey)
        )
      );

    // Enrich transactions with category names
    const enrichedTransactions = await Promise.all(
      dayTransactions.map(async (txn) => {
        let categoryName: string | undefined;

        if (txn.categoryId && txn.categoryId !== 'transfer_in' && txn.categoryId !== 'transfer_out') {
          const category = await db
            .select()
            .from(budgetCategories)
            .where(
              and(
                eq(budgetCategories.id, txn.categoryId),
                eq(budgetCategories.userId, userId)
              )
            )
            .limit(1);

          if (category.length > 0) {
            categoryName = category[0].name;
          }
        }

        return {
          id: txn.id,
          description: txn.description,
          amount: parseFloat(txn.amount?.toString() || '0'),
          type: txn.type as
            | 'income'
            | 'expense'
            | 'transfer_in'
            | 'transfer_out',
          category: categoryName,
        };
      })
    );

    // Calculate summary statistics
    const summary = {
      incomeCount: enrichedTransactions.filter(
        (t) => t.type === 'income'
      ).length,
      expenseCount: enrichedTransactions.filter(
        (t) => t.type === 'expense'
      ).length,
      transferCount: enrichedTransactions.filter(
        (t) =>
          t.type === 'transfer_in' || t.type === 'transfer_out'
      ).length,
      totalSpent: enrichedTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      billDueCount: 0, // TODO: Implement when bills system is ready
      billOverdueCount: 0, // TODO: Implement when bills system is ready
    };

    return Response.json({
      date: dateKey,
      transactions: enrichedTransactions,
      bills: [], // TODO: Add bills when bills system is ready
      summary,
    });
  } catch (error) {
    console.error('Error fetching calendar day data:', error);
    return Response.json(
      { error: 'Failed to fetch day details' },
      { status: 500 }
    );
  }
}
