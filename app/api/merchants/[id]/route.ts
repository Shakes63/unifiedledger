import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { merchants, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Normalize merchant name for comparison
function normalizeMerchantName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// PUT - Update a merchant
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

    const { name, categoryId, isSalesTaxExempt } = body;

    // Verify merchant belongs to user AND household
    const merchant = await db
      .select()
      .from(merchants)
      .where(
        and(
          eq(merchants.id, id),
          eq(merchants.userId, userId),
          eq(merchants.householdId, householdId)
        )
      )
      .limit(1);

    if (merchant.length === 0) {
      return Response.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // If updating name, check for duplicates in household
    if (name && name.trim() !== merchant[0].name) {
      const normalizedName = normalizeMerchantName(name);
      const existing = await db
        .select()
        .from(merchants)
        .where(
          and(
            eq(merchants.userId, userId),
            eq(merchants.householdId, householdId),
            eq(merchants.normalizedName, normalizedName)
          )
        )
        .limit(1);

      if (existing && existing.length > 0) {
        return Response.json(
          { error: 'Merchant with this name already exists in household' },
          { status: 400 }
        );
      }
    }

    // Update merchant
    const updateData: Partial<typeof merchants.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (name) {
      updateData.name = name.trim();
      updateData.normalizedName = normalizeMerchantName(name);
    }

    if (categoryId !== undefined) {
      updateData.categoryId = categoryId;
    }

    if (isSalesTaxExempt !== undefined) {
      updateData.isSalesTaxExempt = isSalesTaxExempt;
    }

    await db
      .update(merchants)
      .set(updateData)
      .where(eq(merchants.id, id));

    const updatedMerchant = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, id))
      .limit(1);

    return Response.json(updatedMerchant[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error updating merchant:', error);
    return Response.json(
      { error: 'Failed to update merchant' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a merchant
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

    // Verify merchant belongs to user AND household
    const merchant = await db
      .select()
      .from(merchants)
      .where(
        and(
          eq(merchants.id, id),
          eq(merchants.userId, userId),
          eq(merchants.householdId, householdId)
        )
      )
      .limit(1);

    if (merchant.length === 0) {
      return Response.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // CRITICAL: Check if any transactions in household use this merchant
    const usageCount = await db
      .select({ count: count() })
      .from(transactions)
      .where(
        and(
          eq(transactions.merchantId, id),
          eq(transactions.householdId, householdId)
        )
      );

    if (usageCount[0].count > 0) {
      return Response.json(
        {
          error: `Cannot delete merchant. It is used by ${usageCount[0].count} transaction(s) in this household.`,
        },
        { status: 400 }
      );
    }

    // Delete merchant
    await db
      .delete(merchants)
      .where(eq(merchants.id, id));

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error deleting merchant:', error);
    return Response.json(
      { error: 'Failed to delete merchant' },
      { status: 500 }
    );
  }
}
