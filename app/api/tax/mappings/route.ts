/**
 * Tax Category Mappings API
 * GET - List user's category-to-tax-category mappings
 * POST - Create a new mapping
 */

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { categoryTaxMappings, budgetCategories, taxCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tax/mappings
 * Returns user's mappings for a given tax year, plus unmapped tax-deductible categories
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return Response.json({ error: 'Household ID is required' }, { status: 400 });
    }

    // Get year from query params (default to current year)
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString());

    // Fetch existing mappings with joined category info
    const mappings = await db
      .select({
        mapping: categoryTaxMappings,
        budgetCategory: budgetCategories,
        taxCategory: taxCategories,
      })
      .from(categoryTaxMappings)
      .innerJoin(budgetCategories, eq(categoryTaxMappings.budgetCategoryId, budgetCategories.id))
      .innerJoin(taxCategories, eq(categoryTaxMappings.taxCategoryId, taxCategories.id))
      .where(
        and(
          eq(categoryTaxMappings.userId, userId),
          eq(categoryTaxMappings.taxYear, year),
          eq(budgetCategories.householdId, householdId)
        )
      );

    // Format mappings response
    const formattedMappings = mappings.map((m) => ({
      id: m.mapping.id,
      budgetCategoryId: m.budgetCategory.id,
      budgetCategoryName: m.budgetCategory.name,
      budgetCategoryType: m.budgetCategory.type,
      taxCategoryId: m.taxCategory.id,
      taxCategoryName: m.taxCategory.name,
      taxCategoryFormType: m.taxCategory.formType,
      taxCategoryLineNumber: m.taxCategory.lineNumber,
      taxCategoryCategory: m.taxCategory.category,
      taxYear: m.mapping.taxYear,
      allocationPercentage: m.mapping.allocationPercentage,
      notes: m.mapping.notes,
    }));

    // Get mapped budget category IDs
    const mappedCategoryIds = new Set(mappings.map((m) => m.budgetCategory.id));

    // Fetch all user's budget categories
    const allCategories = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isActive, true)
        )
      );

    // Filter to unmapped categories (all categories that haven't been mapped yet)
    // Include tax-deductible ones but also other expense categories user might want to map
    const unmappedCategories = allCategories
      .filter((cat) => !mappedCategoryIds.has(cat.id))
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        type: cat.type,
        isTaxDeductible: cat.isTaxDeductible,
        isBusinessCategory: cat.isBusinessCategory,
      }));

    // Separate into tax-deductible and other categories for UI convenience
    const unmappedTaxDeductible = unmappedCategories.filter((c) => c.isTaxDeductible);
    const unmappedOther = unmappedCategories.filter((c) => !c.isTaxDeductible);

    return Response.json({
      data: formattedMappings,
      unmappedTaxDeductible,
      unmappedOther,
      taxYear: year,
      totalMappings: formattedMappings.length,
      totalUnmappedTaxDeductible: unmappedTaxDeductible.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching tax mappings:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/tax/mappings
 * Create a new category-to-tax-category mapping
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return Response.json({ error: 'Household ID is required' }, { status: 400 });
    }

    const {
      budgetCategoryId,
      taxCategoryId,
      taxYear = new Date().getFullYear(),
      allocationPercentage = 100,
      notes,
    } = body;

    // Validate required fields
    if (!budgetCategoryId || !taxCategoryId) {
      return Response.json(
        { error: 'Budget category ID and tax category ID are required' },
        { status: 400 }
      );
    }

    // Validate allocation percentage
    if (allocationPercentage < 0 || allocationPercentage > 100) {
      return Response.json(
        { error: 'Allocation percentage must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Validate budget category belongs to user/household
    const [budgetCat] = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, budgetCategoryId),
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .limit(1);

    if (!budgetCat) {
      return Response.json({ error: 'Budget category not found' }, { status: 404 });
    }

    // Validate tax category exists
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

    // Check if mapping already exists for this combination
    const [existingMapping] = await db
      .select()
      .from(categoryTaxMappings)
      .where(
        and(
          eq(categoryTaxMappings.userId, userId),
          eq(categoryTaxMappings.budgetCategoryId, budgetCategoryId),
          eq(categoryTaxMappings.taxYear, taxYear)
        )
      )
      .limit(1);

    if (existingMapping) {
      return Response.json(
        { error: 'A mapping already exists for this category and year' },
        { status: 409 }
      );
    }

    // Create the mapping
    const mappingId = nanoid();
    await db.insert(categoryTaxMappings).values({
      id: mappingId,
      userId,
      budgetCategoryId,
      taxCategoryId,
      taxYear,
      allocationPercentage,
      notes: notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Also mark the budget category as tax-deductible if it isn't already
    if (!budgetCat.isTaxDeductible) {
      await db
        .update(budgetCategories)
        .set({ isTaxDeductible: true })
        .where(eq(budgetCategories.id, budgetCategoryId));
    }

    return Response.json(
      {
        id: mappingId,
        budgetCategoryId,
        budgetCategoryName: budgetCat.name,
        taxCategoryId,
        taxCategoryName: taxCat.name,
        taxCategoryFormType: taxCat.formType,
        taxYear,
        allocationPercentage,
        message: 'Mapping created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error creating tax mapping:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

