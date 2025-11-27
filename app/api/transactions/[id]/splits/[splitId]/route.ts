import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, transactionSplits, budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Type for split update data with properly typed fields
 */
interface SplitUpdateData {
  categoryId?: string;
  amount?: number;
  percentage?: number;
  isPercentage?: boolean;
  description?: string | null;
  notes?: string | null;
  sortOrder?: number;
  updatedAt: string;
}

/**
 * PUT /api/transactions/[id]/splits/[splitId]
 * Update a specific split
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; splitId: string }> }
) {
  const { id: transactionId, splitId } = await params;
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const {
      categoryId,
      amount,
      percentage,
      isPercentage,
      description,
      notes,
      sortOrder,
    } = body;

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

    // Verify transaction belongs to user AND household
    const transaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);

    if (transaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify split belongs to transaction, user, AND household
    const split = await db
      .select()
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.id, splitId),
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, userId),
          eq(transactionSplits.householdId, householdId)
        )
      )
      .limit(1);

    if (split.length === 0) {
      return Response.json(
        { error: 'Split not found' },
        { status: 404 }
      );
    }

    // If category is being changed, verify it exists and belongs to household
    if (categoryId) {
      const category = await db
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

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found in household' },
          { status: 404 }
        );
      }
    }

    // Build update object with only provided fields
    const updateData: SplitUpdateData = {
      updatedAt: new Date().toISOString(),
    };

    if (categoryId) updateData.categoryId = categoryId;
    if (isPercentage !== undefined) {
      updateData.isPercentage = isPercentage;
      if (isPercentage && percentage !== undefined) {
        updateData.percentage = percentage;
        updateData.amount = 0;
      } else if (!isPercentage && amount !== undefined) {
        updateData.amount = amount;
        updateData.percentage = 0;
      }
    } else {
      if (amount !== undefined) updateData.amount = amount;
      if (percentage !== undefined) updateData.percentage = percentage;
    }
    if (description !== undefined) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    // Update the split
    await db
      .update(transactionSplits)
      .set(updateData)
      .where(eq(transactionSplits.id, splitId));

    // Fetch and return updated split
    const updatedSplit = await db
      .select()
      .from(transactionSplits)
      .where(eq(transactionSplits.id, splitId))
      .limit(1);

    return Response.json(updatedSplit[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error updating split:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions/[id]/splits/[splitId]
 * Delete a specific split
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; splitId: string }> }
) {
  const { id: transactionId, splitId } = await params;
  try {
    const { userId } = await requireAuth();

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

    // Verify transaction belongs to user AND household
    const transaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);

    if (transaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify split belongs to transaction, user, AND household
    const split = await db
      .select()
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.id, splitId),
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, userId),
          eq(transactionSplits.householdId, householdId)
        )
      )
      .limit(1);

    if (split.length === 0) {
      return Response.json(
        { error: 'Split not found' },
        { status: 404 }
      );
    }

    // Delete the split
    await db
      .delete(transactionSplits)
      .where(eq(transactionSplits.id, splitId));

    // Check if there are any remaining splits
    const remainingSplits = await db
      .select()
      .from(transactionSplits)
      .where(eq(transactionSplits.transactionId, transactionId));

    // If no splits remain, mark transaction as not split
    if (remainingSplits.length === 0) {
      await db
        .update(transactions)
        .set({
          isSplit: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(transactions.id, transactionId));
    }

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error deleting split:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
