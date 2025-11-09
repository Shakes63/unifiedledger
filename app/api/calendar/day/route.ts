import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, budgetCategories, billInstances, bills, accounts } from '@/lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';
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

    // Update any pending bills that are now overdue
    const today = format(new Date(), 'yyyy-MM-dd');
    await db
      .update(billInstances)
      .set({ status: 'overdue' })
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.status, 'pending'),
          lt(billInstances.dueDate, today)
        )
      );

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

    // Enrich transactions with category names and account names
    const enrichedTransactions = await Promise.all(
      dayTransactions.map(async (txn) => {
        let categoryName: string | undefined;
        let accountName: string | undefined;

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

        // Get the account name for this transaction
        if (txn.accountId) {
          const account = await db
            .select()
            .from(accounts)
            .where(
              and(
                eq(accounts.id, txn.accountId),
                eq(accounts.userId, userId)
              )
            )
            .limit(1);

          if (account.length > 0) {
            accountName = account[0].name;
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
          merchant: txn.merchant || null,
          accountName: accountName,
        };
      })
    );

    // Get all bill instances for this day
    const dayBillInstances = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.dueDate, dateKey)
        )
      );

    // Enrich bill instances with bill details
    const enrichedBills = await Promise.all(
      dayBillInstances.map(async (instance) => {
        const bill = await db
          .select()
          .from(bills)
          .where(
            and(
              eq(bills.id, instance.billId),
              eq(bills.userId, userId)
            )
          )
          .limit(1);

        return {
          id: instance.id,
          description: bill[0]?.name || 'Unknown Bill',
          amount: instance.expectedAmount,
          dueDate: instance.dueDate,
          status: instance.status as 'pending' | 'paid' | 'overdue',
        };
      })
    );

    // Calculate summary statistics
    const billDueCount = dayBillInstances.filter(
      (b) => b.status === 'pending'
    ).length;
    const billOverdueCount = dayBillInstances.filter(
      (b) => b.status === 'overdue'
    ).length;

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
      billDueCount,
      billOverdueCount,
    };

    return Response.json({
      date: dateKey,
      transactions: enrichedTransactions,
      bills: enrichedBills,
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
