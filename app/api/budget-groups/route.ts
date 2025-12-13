import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { budgetCategories, transactions } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface BudgetGroupWithChildren {
  id: string;
  name: string;
  type: string;
  targetAllocation: number | null;
  children: Array<{
    id: string;
    name: string;
    type: string;
    monthlyBudget: number;
  }>;
  totalBudget: number;
  totalSpent: number;
}

/**
 * GET /api/budget-groups
 * Get all budget groups with their child categories and aggregated budgets
 * Query params:
 *   - month: YYYY-MM format for calculating spent amounts (defaults to current month)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    // Get all budget groups
    const groups = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isBudgetGroup, true),
          eq(budgetCategories.isActive, true)
        )
      )
      .orderBy(budgetCategories.sortOrder, budgetCategories.name);

    // Get all categories (including those with parents and orphans)
    const allCategories = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isBudgetGroup, false),
          eq(budgetCategories.isActive, true)
        )
      )
      .orderBy(budgetCategories.sortOrder, budgetCategories.name);

    // Get spending for all categories in this month
    const spending = await db
      .select({
        categoryId: transactions.categoryId,
        total: sql<number>`SUM(CASE WHEN ${transactions.type} IN ('expense', 'transfer_out') THEN ${transactions.amount} ELSE 0 END)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          sql`${transactions.date} >= ${startDate}`,
          sql`${transactions.date} <= ${endDate}`
        )
      )
      .groupBy(transactions.categoryId);

    const spendingMap = new Map(
      spending.map(s => [s.categoryId, s.total || 0])
    );

    // Build groups with children
    const budgetGroups: BudgetGroupWithChildren[] = groups.map(group => {
      const children = allCategories
        .filter(cat => cat.parentId === group.id)
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          type: cat.type,
          monthlyBudget: cat.monthlyBudget || 0,
        }));

      const totalBudget = children.reduce(
        (sum, child) => new Decimal(sum).plus(child.monthlyBudget).toNumber(),
        0
      );

      const totalSpent = children.reduce(
        (sum, child) => new Decimal(sum).plus(spendingMap.get(child.id) || 0).toNumber(),
        0
      );

      return {
        id: group.id,
        name: group.name,
        type: group.type,
        targetAllocation: group.targetAllocation,
        children,
        totalBudget,
        totalSpent,
      };
    });

    // Get unassigned categories (no parent)
    const unassigned = allCategories
      .filter(cat => !cat.parentId)
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        type: cat.type,
        monthlyBudget: cat.monthlyBudget || 0,
        spent: spendingMap.get(cat.id) || 0,
      }));

    return Response.json({
      groups: budgetGroups,
      unassigned,
      month,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Budget groups fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budget-groups
 * Create a new budget group
 * Request body:
 * {
 *   name: string,
 *   type: 'income' | 'expense' | 'savings',
 *   targetAllocation?: number (percentage, e.g., 50 for 50%)
 * }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const { name, type, targetAllocation } = body;

    if (!name || !type) {
      return Response.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    const validTypes = ['income', 'expense', 'savings'];
    if (!validTypes.includes(type)) {
      return Response.json(
        { error: 'Invalid type. Must be income, expense, or savings' },
        { status: 400 }
      );
    }

    // Check for duplicate name
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

    if (existing.length > 0) {
      return Response.json(
        { error: 'A category or group with this name already exists' },
        { status: 400 }
      );
    }

    const groupId = nanoid();
    const groupData = {
      id: groupId,
      userId,
      householdId,
      name,
      type,
      monthlyBudget: 0, // Budget groups don't have direct budgets
      isBudgetGroup: true,
      targetAllocation: targetAllocation || null,
      createdAt: new Date().toISOString(),
      usageCount: 0,
      sortOrder: 0,
    };

    await db.insert(budgetCategories).values(groupData);

    return Response.json(groupData, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Budget group creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/budget-groups
 * Update a budget group or assign/unassign categories
 * Request body:
 * {
 *   groupId: string,
 *   action: 'rename' | 'assign' | 'unassign' | 'update',
 *   name?: string (for rename),
 *   categoryIds?: string[] (for assign/unassign),
 *   targetAllocation?: number (for update)
 * }
 */
export async function PUT(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const { groupId, action, name, categoryIds, targetAllocation } = body;

    if (!groupId || !action) {
      return Response.json(
        { error: 'groupId and action are required' },
        { status: 400 }
      );
    }

    // Verify group exists and belongs to user
    const group = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, groupId),
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isBudgetGroup, true)
        )
      )
      .limit(1);

    if (!group.length) {
      return Response.json(
        { error: 'Budget group not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'rename': {
        if (!name) {
          return Response.json(
            { error: 'Name is required for rename action' },
            { status: 400 }
          );
        }

        // Check for duplicate name
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

        if (existing.length > 0 && existing[0].id !== groupId) {
          return Response.json(
            { error: 'A category or group with this name already exists' },
            { status: 400 }
          );
        }

        await db
          .update(budgetCategories)
          .set({ name })
          .where(eq(budgetCategories.id, groupId));

        return Response.json({ success: true, message: 'Group renamed' });
      }

      case 'assign': {
        if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
          return Response.json(
            { error: 'categoryIds array is required for assign action' },
            { status: 400 }
          );
        }

        const groupType = group[0].type;

        // Verify all categories exist and belong to user
        const categories = await db
          .select()
          .from(budgetCategories)
          .where(
            and(
              eq(budgetCategories.userId, userId),
              eq(budgetCategories.householdId, householdId),
              eq(budgetCategories.isBudgetGroup, false)
            )
          );

        const selectedCategories = categories.filter(cat => categoryIds.includes(cat.id));
        const validCategoryIds = selectedCategories.map(cat => cat.id);

        if (validCategoryIds.length !== categoryIds.length) {
          return Response.json(
            { error: 'Some category IDs are invalid' },
            { status: 400 }
          );
        }

        // Enforce same-type grouping (prevents cross-type subcategories)
        const invalidType = selectedCategories.filter(cat => cat.type !== groupType);
        if (invalidType.length > 0) {
          return Response.json(
            { error: 'All assigned categories must match the group type' },
            { status: 400 }
          );
        }

        // Assign categories to group
        for (const catId of validCategoryIds) {
          await db
            .update(budgetCategories)
            .set({ parentId: groupId })
            .where(eq(budgetCategories.id, catId));
        }

        return Response.json({ 
          success: true, 
          message: `${validCategoryIds.length} categories assigned to group` 
        });
      }

      case 'unassign': {
        if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
          return Response.json(
            { error: 'categoryIds array is required for unassign action' },
            { status: 400 }
          );
        }

        // Unassign categories from group (set parentId to null)
        for (const catId of categoryIds) {
          await db
            .update(budgetCategories)
            .set({ parentId: null })
            .where(
              and(
                eq(budgetCategories.id, catId),
                eq(budgetCategories.userId, userId),
                eq(budgetCategories.householdId, householdId),
                eq(budgetCategories.parentId, groupId)
              )
            );
        }

        return Response.json({ 
          success: true, 
          message: 'Categories unassigned from group' 
        });
      }

      case 'update': {
        const updates: { name?: string; targetAllocation?: number | null } = {};
        
        if (name !== undefined) {
          // Check for duplicate name
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

          if (existing.length > 0 && existing[0].id !== groupId) {
            return Response.json(
              { error: 'A category or group with this name already exists' },
              { status: 400 }
            );
          }
          updates.name = name;
        }

        if (targetAllocation !== undefined) {
          updates.targetAllocation = targetAllocation;
        }

        if (Object.keys(updates).length === 0) {
          return Response.json(
            { error: 'No valid fields to update' },
            { status: 400 }
          );
        }

        await db
          .update(budgetCategories)
          .set(updates)
          .where(eq(budgetCategories.id, groupId));

        return Response.json({ success: true, message: 'Group updated' });
      }

      default:
        return Response.json(
          { error: 'Invalid action. Must be rename, assign, unassign, or update' },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Budget group update error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/budget-groups
 * Delete a budget group (orphans children - sets their parentId to null)
 * Request body:
 * {
 *   groupId: string
 * }
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const { groupId } = body;

    if (!groupId) {
      return Response.json(
        { error: 'groupId is required' },
        { status: 400 }
      );
    }

    // Verify group exists and belongs to user
    const group = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, groupId),
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isBudgetGroup, true)
        )
      )
      .limit(1);

    if (!group.length) {
      return Response.json(
        { error: 'Budget group not found' },
        { status: 404 }
      );
    }

    // Orphan all children (set parentId to null)
    await db
      .update(budgetCategories)
      .set({ parentId: null })
      .where(
        and(
          eq(budgetCategories.parentId, groupId),
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      );

    // Delete the group
    await db
      .delete(budgetCategories)
      .where(eq(budgetCategories.id, groupId));

    return Response.json({ 
      success: true, 
      message: 'Budget group deleted and children unassigned' 
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Budget group deletion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
