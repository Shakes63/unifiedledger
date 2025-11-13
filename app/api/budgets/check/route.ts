import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions, budgetCategories } from '@/lib/db/schema';
import { eq, and, gte, lte, sum } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId');

    if (!categoryId) {
      return Response.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    // Get the budget category
    const budget = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, categoryId),
          eq(budgetCategories.userId, userId)
        )
      )
      .limit(1);

    if (budget.length === 0) {
      return Response.json(
        { error: 'Budget category not found' },
        { status: 404 }
      );
    }

    const monthlyBudget = budget[0].monthlyBudget || 0;

    // Get current month's date range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    // Get spending for this month and category
    const spendingResult = await db
      .select({
        total: sum(transactions.amount),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.categoryId, categoryId),
          eq(transactions.type, 'expense'),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd)
        )
      );

    const spent = spendingResult[0]?.total ? parseFloat(spendingResult[0].total.toString()) : 0;

    // Calculate percentage
    const percentage = monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0;

    // Determine warning level
    let warningLevel: 'none' | 'warning' | 'exceeded' = 'none';
    if (percentage >= 100) {
      warningLevel = 'exceeded';
    } else if (percentage >= 80) {
      warningLevel = 'warning';
    }

    return Response.json({
      categoryId,
      categoryName: budget[0].name,
      monthlyBudget,
      spent,
      remaining: Math.max(0, monthlyBudget - spent),
      percentage: Math.round(percentage),
      warningLevel,
      isOverBudget: spent > monthlyBudget,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Budget check error:', error);
    return Response.json(
      { error: 'Failed to check budget' },
      { status: 500 }
    );
  }
}
