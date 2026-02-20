import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, budgetCategories } from '@/lib/db/schema';
import { getMonthRangeForDate, parseLocalDateString, toLocalDateString } from '@/lib/utils/local-date';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';

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
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'monthly'; // 'weekly' or 'monthly'
    const dateStr = url.searchParams.get('date'); // YYYY-MM-DD format

    let dateStart: string;
    let dateEnd: string;
    let periodLabel: string;

    if (period === 'weekly') {
      const date = dateStr ? parseLocalDateString(dateStr) : new Date();
      const startDate = new Date(date);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      dateStart = toLocalDateString(startDate);
      dateEnd = toLocalDateString(endDate);
      periodLabel = `Week of ${dateStart}`;
    } else {
      // Monthly
      const date = dateStr ? parseLocalDateString(dateStr) : new Date();
      const monthRange = getMonthRangeForDate(date);
      dateStart = monthRange.startDate;
      dateEnd = monthRange.endDate;
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
          eq(transactions.householdId, householdId),
          gte(transactions.date, dateStart),
          lte(transactions.date, dateEnd)
        )
      );

    // Calculate totals by type
    const getTxnAmountCents = (txn: {
      amount: number;
      amountCents: number | string | bigint | null;
    }) => {
      if (txn.amountCents !== null && txn.amountCents !== undefined) {
        return Number(txn.amountCents);
      }
      return toMoneyCents(txn.amount) ?? 0;
    };

    const centsToAmount = (cents: number) => new Decimal(cents).div(100).toNumber();

    const incomeTotalCents = txns
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + getTxnAmountCents(t), 0);

    const expenseTotalCents = txns
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + getTxnAmountCents(t), 0);

    const transferTotalCents = txns
      .filter((t) => t.type === 'transfer_in' || t.type === 'transfer_out')
      .reduce((sum, t) => sum + getTxnAmountCents(t), 0);

    const incomeTotal = centsToAmount(incomeTotalCents);
    const expenseTotal = centsToAmount(expenseTotalCents);
    const transferTotal = centsToAmount(transferTotalCents);

    // Group by category
    const byCategory = new Map<string, { amountCents: number; count: number; categoryName: string }>();

    for (const txn of txns) {
      if (txn.type === 'expense' && txn.categoryId) {
        if (!byCategory.has(txn.categoryId)) {
          byCategory.set(txn.categoryId, { amountCents: 0, count: 0, categoryName: '' });
        }
        const entry = byCategory.get(txn.categoryId)!;
        entry.amountCents += getTxnAmountCents(txn);
        entry.count += 1;
      }
    }

    // Get category names
    const categoryIds = Array.from(byCategory.keys());
    let categories: Array<{ id: string; name: string | null }> = [];

    if (categoryIds.length > 0) {
      categories = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId),
            inArray(budgetCategories.id, categoryIds)
          )
        );
    }

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const categoryData = Array.from(byCategory.entries())
      .map(([categoryId, { amountCents, count }]) => {
        const amount = centsToAmount(amountCents);
        return {
        categoryId,
        categoryName: categoryMap.get(categoryId) || 'Uncategorized',
        amount,
        percentage: expenseTotal > 0 ? Math.round((amount / expenseTotal) * 100) : 0,
        transactionCount: count,
      };
      })
      .sort((a, b) => b.amount - a.amount);

    // Get top merchants
    const merchantSpending = new Map<string, { amountCents: number; count: number }>();

    for (const txn of txns.filter((t) => t.type === 'expense')) {
      const merchant = txn.description || 'Unknown';
      if (!merchantSpending.has(merchant)) {
        merchantSpending.set(merchant, { amountCents: 0, count: 0 });
      }
      const entry = merchantSpending.get(merchant)!;
      entry.amountCents += getTxnAmountCents(txn);
      entry.count += 1;
    }

    const topMerchants = Array.from(merchantSpending.entries())
      .map(([merchant, { amountCents, count }]) => ({
        merchant,
        amount: centsToAmount(amountCents),
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Spending summary error:', error);
    return Response.json(
      { error: 'Failed to generate spending summary' },
      { status: 500 }
    );
  }
}
