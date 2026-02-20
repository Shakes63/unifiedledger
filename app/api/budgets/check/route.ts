import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, budgetCategories } from '@/lib/db/schema';
import { getMonthRangeForDate } from '@/lib/utils/local-date';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

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
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId)
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
    const { startDate: monthStart, endDate: monthEnd } = getMonthRangeForDate(now);

    // Get spending for this month and category
    const spendingResult = await db
      .select({
        totalCents: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId),
          eq(transactions.categoryId, categoryId),
          eq(transactions.type, 'expense'),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd)
        )
      );

    const spent = new Decimal(spendingResult[0]?.totalCents ?? 0).div(100).toNumber();

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
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Budget check error:', error);
    return Response.json(
      { error: 'Failed to check budget' },
      { status: 500 }
    );
  }
}
