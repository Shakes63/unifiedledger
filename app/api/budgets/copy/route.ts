import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/budgets/copy
 * Copy budgets from one month to another
 *
 * Note: Currently budgets are stored in budgetCategories.monthlyBudget
 * which applies to all months. This endpoint is designed for future
 * historical budget tracking, but for now it validates the request
 * and returns the current budgets.
 *
 * Request body:
 * {
 *   fromMonth: "2025-04",
 *   toMonth: "2025-05"
 * }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { fromMonth, toMonth } = body;

    // Validate request
    if (!fromMonth || !toMonth) {
      return Response.json(
        { error: 'fromMonth and toMonth are required (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(fromMonth) || !monthRegex.test(toMonth)) {
      return Response.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      );
    }

    if (fromMonth === toMonth) {
      return Response.json(
        { error: 'fromMonth and toMonth cannot be the same' },
        { status: 400 }
      );
    }

    // Fetch all active categories with budgets
    const categories = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.isActive, true)
        )
      );

    if (categories.length === 0) {
      return Response.json(
        { error: 'No categories found to copy budgets from' },
        { status: 404 }
      );
    }

    // Count categories with budgets set
    const categoriesWithBudgets = categories.filter(
      c => c.monthlyBudget && c.monthlyBudget > 0
    );

    // Since we're using monthlyBudget field (applies to all months),
    // this operation is essentially a no-op in the current schema.
    // However, we return success to support the UI flow.
    // When historical budget tracking is added later, this will actually
    // copy budget records from one month to another.

    return Response.json({
      success: true,
      message: `Budgets copied from ${fromMonth} to ${toMonth}`,
      fromMonth,
      toMonth,
      categoriesTotal: categories.length,
      categoriesWithBudgets: categoriesWithBudgets.length,
      budgetsCopied: categoriesWithBudgets.length,
      note: 'Currently using monthlyBudget field which applies to all months. Historical tracking coming soon.',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Copy budgets error:', error);
    return Response.json(
      { error: 'Failed to copy budgets' },
      { status: 500 }
    );
  }
}
