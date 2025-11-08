import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, transactionSplits, budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
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

    // Verify transaction belongs to user
    const transaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    if (transaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify split belongs to transaction and user
    const split = await db
      .select()
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.id, splitId),
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, userId)
        )
      )
      .limit(1);

    if (split.length === 0) {
      return Response.json(
        { error: 'Split not found' },
        { status: 404 }
      );
    }

    // If category is being changed, verify it exists
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify transaction belongs to user
    const transaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    if (transaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify split belongs to transaction and user
    const split = await db
      .select()
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.id, splitId),
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, userId)
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
    console.error('Error deleting split:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
