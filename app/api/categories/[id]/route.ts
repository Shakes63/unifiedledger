import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { budgetCategories, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type CategoryType = NonNullable<typeof budgetCategories.$inferSelect['type']>;
const CATEGORY_TYPES: readonly CategoryType[] = ['income', 'expense', 'savings'];
function isCategoryType(value: string): value is CategoryType {
  return (CATEGORY_TYPES as readonly string[]).includes(value);
}

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

    const {
      name,
      type,
      monthlyBudget,
      dueDate,
      isTaxDeductible,
      isBusinessCategory,
      incomeFrequency,
      parentId,
      isBudgetGroup,
      targetAllocation,
    } = body;

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

    const current = category[0];
    const nextType: CategoryType = (type ?? current.type) as CategoryType;
    const nextIsBudgetGroup: boolean = isBudgetGroup ?? current.isBudgetGroup;

    // Budget groups cannot have parents (prevent nesting/cycles)
    if (nextIsBudgetGroup) {
      if (parentId !== undefined && parentId !== null && parentId !== '') {
        return Response.json(
          { error: 'Budget groups cannot have a parent' },
          { status: 400 }
        );
      }
    } else {
      // Prevent self-parenting cycles
      if (parentId !== undefined && parentId === id) {
        return Response.json(
          { error: 'A category cannot be its own parent' },
          { status: 400 }
        );
      }
    }

    // If updating name, check for duplicates in household
    if (name && name !== current.name) {
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

    // Validate type if provided
    if (type) {
      if (!isCategoryType(type)) {
        return Response.json(
          { error: 'Invalid category type. Must be income, expense, or savings' },
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

    // Validate parentId if provided
    if (parentId !== undefined && parentId !== null && parentId !== '') {
      const parent = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, parentId),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId),
            eq(budgetCategories.isBudgetGroup, true)
          )
        )
        .limit(1);

      if (!parent.length) {
        return Response.json(
          { error: 'Parent category not found or is not a parent category' },
          { status: 400 }
        );
      }

      // Parent/child type must match (prevents cross-type groupings)
      if (parent[0].type !== nextType) {
        return Response.json(
          { error: 'Parent category type must match category type' },
          { status: 400 }
        );
      }
    } else if (type && current.parentId) {
      // If type changes and parentId isn't explicitly cleared, verify existing parent still matches
      const parent = await db
        .select({ id: budgetCategories.id, type: budgetCategories.type })
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, current.parentId),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId),
            eq(budgetCategories.isBudgetGroup, true)
          )
        )
        .limit(1);

      if (parent.length && parent[0].type !== nextType) {
        return Response.json(
          { error: 'Category type changed; clear parent category or select a matching parent' },
          { status: 400 }
        );
      }
    }

    // Update the category
    await db.update(budgetCategories)
      .set({
        name: name || current.name,
        type: nextType,
        monthlyBudget: monthlyBudget ?? current.monthlyBudget,
        dueDate: dueDate !== undefined ? dueDate : current.dueDate,
        isTaxDeductible: isTaxDeductible !== undefined ? isTaxDeductible : current.isTaxDeductible,
        isBusinessCategory: isBusinessCategory !== undefined ? isBusinessCategory : current.isBusinessCategory,
        incomeFrequency: incomeFrequency !== undefined ? incomeFrequency : current.incomeFrequency,
        parentId: nextIsBudgetGroup
          ? null
          : (parentId !== undefined ? (parentId === '' ? null : parentId) : current.parentId),
        isBudgetGroup: nextIsBudgetGroup,
        targetAllocation: targetAllocation !== undefined ? targetAllocation : current.targetAllocation,
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

    // Check if this is a parent category (budget group)
    if (category[0].isBudgetGroup) {
      // Orphan all children (set parentId to null) before deleting
      await db.update(budgetCategories)
        .set({ parentId: null })
        .where(
          and(
            eq(budgetCategories.parentId, id),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
          )
        );
    } else {
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
