import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { budgetCategories, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { id } = await params;
    const body = await request.json();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const { name, monthlyBudget, dueDate, isTaxDeductible, isBusinessCategory, incomeFrequency } = body;

    // Verify category belongs to user AND household
    const category = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, id),
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .limit(1);

    if (!category || category.length === 0) {
      return Response.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // If updating name, check for duplicates in household
    if (name && name !== category[0].name) {
      const existing = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId),
            eq(budgetCategories.name, name)
          )
        )
        .limit(1);

      if (existing && existing.length > 0) {
        return Response.json(
          { error: 'Category with this name already exists in household' },
          { status: 400 }
        );
      }
    }

    // Validate income frequency if provided
    if (incomeFrequency) {
      const validFrequencies = ['weekly', 'biweekly', 'monthly', 'variable'];
      if (!validFrequencies.includes(incomeFrequency)) {
        return Response.json(
          { error: 'Invalid income frequency. Must be weekly, biweekly, monthly, or variable' },
          { status: 400 }
        );
      }
    }

    // Update the category
    await db.update(budgetCategories)
      .set({
        name: name || category[0].name,
        monthlyBudget: monthlyBudget ?? category[0].monthlyBudget,
        dueDate: dueDate !== undefined ? dueDate : category[0].dueDate,
        isTaxDeductible: isTaxDeductible !== undefined ? isTaxDeductible : category[0].isTaxDeductible,
        isBusinessCategory: isBusinessCategory !== undefined ? isBusinessCategory : category[0].isBusinessCategory,
        incomeFrequency: incomeFrequency !== undefined ? incomeFrequency : category[0].incomeFrequency,
      })
      .where(eq(budgetCategories.id, id));

    return Response.json(
      { message: 'Category updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Category update error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { id } = await params;

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Verify category belongs to user AND household
    const category = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, id),
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .limit(1);

    if (!category || category.length === 0) {
      return Response.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // CRITICAL: Check if any transactions in household use this category
    const usageCount = await db
      .select({ count: count() })
      .from(transactions)
      .where(
        and(
          eq(transactions.categoryId, id),
          eq(transactions.householdId, householdId)
        )
      );

    if (usageCount[0].count > 0) {
      return Response.json(
        {
          error: `Cannot delete category. It is used by ${usageCount[0].count} transaction(s) in this household.`,
        },
        { status: 400 }
      );
    }

    // Delete the category
    await db.delete(budgetCategories).where(eq(budgetCategories.id, id));

    return Response.json(
      { message: 'Category deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Category deletion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
