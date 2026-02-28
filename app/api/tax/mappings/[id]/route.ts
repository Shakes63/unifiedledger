/**
 * Tax Category Mapping Detail API
 * PUT - Update a mapping
 * DELETE - Remove a mapping
 */

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { budgetCategories, categoryTaxMappings, taxCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/tax/mappings/[id]
 * Update an existing mapping
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return Response.json({ error: 'Household ID is required' }, { status: 400 });
    }

    // Find existing mapping
    const [existingMapping] = await db
      .select({ mapping: categoryTaxMappings })
      .from(categoryTaxMappings)
      .innerJoin(
        budgetCategories,
        eq(categoryTaxMappings.budgetCategoryId, budgetCategories.id)
      )
      .where(
        and(
          eq(categoryTaxMappings.id, id),
          eq(categoryTaxMappings.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .limit(1);

    if (!existingMapping) {
      return Response.json({ error: 'Mapping not found' }, { status: 404 });
    }

    const body = await request.json();
    const { taxCategoryId, allocationPercentage, notes } = body;

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    // Validate and set tax category if provided
    if (taxCategoryId !== undefined) {
      const [taxCat] = await db
        .select()
        .from(taxCategories)
        .where(
          and(eq(taxCategories.id, taxCategoryId), eq(taxCategories.isActive, true))
        )
        .limit(1);

      if (!taxCat) {
        return Response.json({ error: 'Tax category not found' }, { status: 404 });
      }
      updates.taxCategoryId = taxCategoryId;
    }

    // Validate and set allocation percentage if provided
    if (allocationPercentage !== undefined) {
      if (allocationPercentage < 0 || allocationPercentage > 100) {
        return Response.json(
          { error: 'Allocation percentage must be between 0 and 100' },
          { status: 400 }
        );
      }
      updates.allocationPercentage = allocationPercentage;
    }

    // Set notes if provided (can be null to clear)
    if (notes !== undefined) {
      updates.notes = notes || null;
    }

    // Perform update
    await db
      .update(categoryTaxMappings)
      .set(updates)
      .where(
        and(
          eq(categoryTaxMappings.id, id),
          eq(categoryTaxMappings.userId, userId)
        )
      );

    // Fetch updated mapping
    const [updatedMapping] = await db
      .select()
      .from(categoryTaxMappings)
      .where(
        and(
          eq(categoryTaxMappings.id, id),
          eq(categoryTaxMappings.userId, userId)
        )
      )
      .limit(1);

    return Response.json({
      id: updatedMapping.id,
      budgetCategoryId: updatedMapping.budgetCategoryId,
      taxCategoryId: updatedMapping.taxCategoryId,
      taxYear: updatedMapping.taxYear,
      allocationPercentage: updatedMapping.allocationPercentage,
      notes: updatedMapping.notes,
      message: 'Mapping updated successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating tax mapping:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tax/mappings/[id]
 * Remove a mapping
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return Response.json({ error: 'Household ID is required' }, { status: 400 });
    }

    // Find existing mapping
    const [existingMapping] = await db
      .select({ mapping: categoryTaxMappings })
      .from(categoryTaxMappings)
      .innerJoin(
        budgetCategories,
        eq(categoryTaxMappings.budgetCategoryId, budgetCategories.id)
      )
      .where(
        and(
          eq(categoryTaxMappings.id, id),
          eq(categoryTaxMappings.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .limit(1);

    if (!existingMapping) {
      return Response.json({ error: 'Mapping not found' }, { status: 404 });
    }

    // Delete the mapping
    await db
      .delete(categoryTaxMappings)
      .where(
        and(
          eq(categoryTaxMappings.id, id),
          eq(categoryTaxMappings.userId, userId)
        )
      );

    return Response.json({
      id,
      message: 'Mapping deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting tax mapping:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

