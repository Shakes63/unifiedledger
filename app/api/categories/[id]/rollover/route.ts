import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  updateCategoryRolloverSettings,
  resetCategoryRollover,
  getCategoryRolloverHistory,
} from '@/lib/budgets/rollover-utils';

export const dynamic = 'force-dynamic';

/**
 * GET - Get rollover settings and history for a category
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Get category
    const category = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, id),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .limit(1);

    if (category.length === 0) {
      return Response.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Get rollover history
    const history = await getCategoryRolloverHistory(id, householdId, 12);

    return Response.json({
      category: {
        id: category[0].id,
        name: category[0].name,
        type: category[0].type,
        monthlyBudget: category[0].monthlyBudget,
        rolloverEnabled: category[0].rolloverEnabled,
        rolloverBalance: category[0].rolloverBalance,
        rolloverLimit: category[0].rolloverLimit,
      },
      history,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Category rollover fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update rollover settings for a category
 * 
 * Body: {
 *   rolloverEnabled?: boolean,
 *   rolloverLimit?: number | null,
 *   rolloverBalance?: number
 * }
 */
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

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Validate rollover limit
    if (body.rolloverLimit !== undefined && body.rolloverLimit !== null) {
      if (typeof body.rolloverLimit !== 'number' || body.rolloverLimit < 0) {
        return Response.json(
          { error: 'Rollover limit must be a positive number or null' },
          { status: 400 }
        );
      }
    }

    // Validate rollover balance
    if (body.rolloverBalance !== undefined) {
      if (typeof body.rolloverBalance !== 'number') {
        return Response.json(
          { error: 'Rollover balance must be a number' },
          { status: 400 }
        );
      }
    }

    // Update settings
    await updateCategoryRolloverSettings(id, householdId, {
      rolloverEnabled: body.rolloverEnabled,
      rolloverLimit: body.rolloverLimit,
      rolloverBalance: body.rolloverBalance,
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'Category not found') {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error('Category rollover update error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Reset rollover balance for a category
 */
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

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Reset the rollover balance
    await resetCategoryRollover(id, householdId);

    return Response.json({ success: true, message: 'Rollover balance reset to 0' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'Category not found') {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error('Category rollover reset error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

