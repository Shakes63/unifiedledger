import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, budgetCategories } from '@/lib/db/schema';
import { eq, and, gte, lte, sum, sql, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface SpendingSummary {
  period: string;
  totalIncome: number;
  totalExpense: number;
  totalTransfer: number;
  netAmount: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
    transactionCount: number;
  }>;
  topMerchants: Array<{
    merchant: string;
    amount: number;
    transactionCount: number;
  }>;
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
    const period = url.searchParams.get('period') || 'monthly'; // 'weekly' or 'monthly'
    const dateStr = url.searchParams.get('date'); // YYYY-MM-DD format

    let dateStart: string;
    let dateEnd: string;
    let periodLabel: string;

    if (period === 'weekly') {
      const date = dateStr ? new Date(dateStr) : new Date();
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek;
      const startDate = new Date(date.setDate(diff));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      dateStart = startDate.toISOString().split('T')[0];
      dateEnd = endDate.toISOString().split('T')[0];
      periodLabel = `Week of ${dateStart}`;
    } else {
      // Monthly
      const date = dateStr ? new Date(dateStr) : new Date();
      dateStart = new Date(date.getFullYear(), date.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      dateEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];
      periodLabel = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      });
    }

    // Get transactions for the period
    const txns = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, dateStart),
          lte(transactions.date, dateEnd)
        )
      );

    // Calculate totals by type
    const incomeTotal = txns
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const expenseTotal = txns
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const transferTotal = txns
      .filter((t) => t.type === 'transfer_in' || t.type === 'transfer_out')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    // Group by category
    const byCategory = new Map<string, { amount: number; count: number; categoryName: string }>();

    for (const txn of txns) {
      if (txn.type === 'expense' && txn.categoryId) {
        if (!byCategory.has(txn.categoryId)) {
          byCategory.set(txn.categoryId, { amount: 0, count: 0, categoryName: '' });
        }
        const entry = byCategory.get(txn.categoryId)!;
        entry.amount += parseFloat(txn.amount.toString());
        entry.count += 1;
      }
    }

    // Get category names
    const categoryIds = Array.from(byCategory.keys());
    let categories: any[] = [];

    if (categoryIds.length > 0) {
      categories = await db
        .select()
        .from(budgetCategories)
        .where(and(eq(budgetCategories.userId, userId), inArray(budgetCategories.id, categoryIds)));
    }

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const categoryData = Array.from(byCategory.entries())
      .map(([categoryId, { amount, count }]) => ({
        categoryId,
        categoryName: categoryMap.get(categoryId) || 'Uncategorized',
        amount,
        percentage: expenseTotal > 0 ? Math.round((amount / expenseTotal) * 100) : 0,
        transactionCount: count,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Get top merchants
    const merchantSpending = new Map<string, { amount: number; count: number }>();

    for (const txn of txns.filter((t) => t.type === 'expense')) {
      const merchant = txn.description || 'Unknown';
      if (!merchantSpending.has(merchant)) {
        merchantSpending.set(merchant, { amount: 0, count: 0 });
      }
      const entry = merchantSpending.get(merchant)!;
      entry.amount += parseFloat(txn.amount.toString());
      entry.count += 1;
    }

    const topMerchants = Array.from(merchantSpending.entries())
      .map(([merchant, { amount, count }]) => ({
        merchant,
        amount,
        transactionCount: count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const summary: SpendingSummary = {
      period: periodLabel,
      totalIncome: incomeTotal,
      totalExpense: expenseTotal,
      totalTransfer: transferTotal,
      netAmount: incomeTotal - expenseTotal,
      byCategory: categoryData,
      topMerchants,
    };

    return Response.json(summary);
  } catch (error) {
    console.error('Spending summary error:', error);
    return Response.json(
      { error: 'Failed to generate spending summary' },
      { status: 500 }
    );
  }
}
