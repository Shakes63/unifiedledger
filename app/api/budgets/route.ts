import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/budgets
 * Fetch all category budgets for a user
 * Optional query params:
 * - month: YYYY-MM (for future historical tracking)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    // Note: month parameter reserved for future use with historical budget tracking

    // Fetch all active categories with their budgets
    const categories = await db
      .select({
        id: budgetCategories.id,
        name: budgetCategories.name,
        type: budgetCategories.type,
        monthlyBudget: budgetCategories.monthlyBudget,
        sortOrder: budgetCategories.sortOrder,
      })
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.isActive, true)
        )
      )
      .orderBy(budgetCategories.sortOrder, budgetCategories.name);

    return Response.json({
      budgets: categories,
      month: month || new Date().toISOString().slice(0, 7), // YYYY-MM
    });
  } catch (error) {
    console.error('Fetch budgets error:', error);
    return Response.json(
      { error: 'Failed to fetch budgets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budgets
 * Update budgets for one or more categories
 * Request body:
 * {
 *   month: "2025-05", // For future use
 *   budgets: [
 *     { categoryId: "...", monthlyBudget: 500 },
 *     { categoryId: "...", monthlyBudget: 1200 }
 *   ]
 * }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { month, budgets } = body;

    // Validate request
    if (!budgets || !Array.isArray(budgets) || budgets.length === 0) {
      return Response.json(
        { error: 'budgets array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate each budget entry
    for (const budget of budgets) {
      if (!budget.categoryId || typeof budget.categoryId !== 'string') {
        return Response.json(
          { error: 'Each budget must have a categoryId' },
          { status: 400 }
        );
      }

      if (
        budget.monthlyBudget === undefined ||
        budget.monthlyBudget === null ||
        typeof budget.monthlyBudget !== 'number'
      ) {
        return Response.json(
          { error: 'Each budget must have a monthlyBudget number' },
          { status: 400 }
        );
      }

      if (budget.monthlyBudget < 0) {
        return Response.json(
          { error: 'monthlyBudget cannot be negative' },
          { status: 400 }
        );
      }
    }

    // Update each category budget
    const updatedCategories = [];

    for (const budget of budgets) {
      // Verify user owns this category
      const existingCategory = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, budget.categoryId),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.isActive, true)
          )
        )
        .limit(1);

      if (existingCategory.length === 0) {
        return Response.json(
          {
            error: `Category ${budget.categoryId} not found or does not belong to user`,
          },
          { status: 404 }
        );
      }

      // Update the budget
      const updated = await db
        .update(budgetCategories)
        .set({
          monthlyBudget: new Decimal(budget.monthlyBudget).toNumber(),
        })
        .where(eq(budgetCategories.id, budget.categoryId))
        .returning();

      updatedCategories.push(updated[0]);
    }

    return Response.json({
      success: true,
      updatedCount: updatedCategories.length,
      categories: updatedCategories,
    });
  } catch (error) {
    console.error('Update budgets error:', error);
    return Response.json(
      { error: 'Failed to update budgets' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/budgets
 * Alias for POST - update budgets
 */
export async function PUT(request: Request) {
  return POST(request);
}
