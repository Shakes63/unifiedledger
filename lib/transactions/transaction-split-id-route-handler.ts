import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions, transactionSplits } from '@/lib/db/schema';
import {
  findInvalidCategoryIds,
  findScopedSplit,
  findScopedTransaction,
  getSplitRouteContext,
  mapSplitRouteError,
} from '@/lib/transactions/transaction-split-route-shared';
import { buildSplitUpdateData } from '@/lib/transactions/transaction-split-update-data';

export async function handleUpdateTransactionSplit(
  request: Request,
  transactionId: string,
  splitId: string
): Promise<Response> {
  try {
    const body = await request.json();
    const {
      amount,
      categoryId,
      description,
      isPercentage,
      notes,
      percentage,
      sortOrder,
    } = body;

    const context = await getSplitRouteContext(request, body);
    const transaction = await findScopedTransaction(transactionId, context);

    if (!transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const split = await findScopedSplit(splitId, transactionId, context);
    if (!split) {
      return Response.json({ error: 'Split not found' }, { status: 404 });
    }

    if (categoryId) {
      const invalidCategoryIds = await findInvalidCategoryIds([categoryId], context);
      if (invalidCategoryIds.length > 0) {
        return Response.json({ error: 'Category not found in household' }, { status: 404 });
      }
    }

    const updateData = buildSplitUpdateData({
      amount,
      categoryId,
      description,
      isPercentage,
      notes,
      percentage,
      sortOrder,
      transactionAmount: transaction.amount,
    });

    await db
      .update(transactionSplits)
      .set(updateData)
      .where(eq(transactionSplits.id, splitId));

    const updatedSplit = await db
      .select()
      .from(transactionSplits)
      .where(eq(transactionSplits.id, splitId))
      .limit(1);

    return Response.json(updatedSplit[0]);
  } catch (error) {
    return mapSplitRouteError(error, 'Error updating split:');
  }
}

export async function handleDeleteTransactionSplit(
  request: Request,
  transactionId: string,
  splitId: string
): Promise<Response> {
  try {
    const context = await getSplitRouteContext(request);
    const transaction = await findScopedTransaction(transactionId, context);

    if (!transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const split = await findScopedSplit(splitId, transactionId, context);
    if (!split) {
      return Response.json({ error: 'Split not found' }, { status: 404 });
    }

    await db.delete(transactionSplits).where(eq(transactionSplits.id, splitId));

    const remainingSplits = await db
      .select({ id: transactionSplits.id })
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, context.userId),
          eq(transactionSplits.householdId, context.householdId)
        )
      )
      .limit(1);

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
    return mapSplitRouteError(error, 'Error deleting split:');
  }
}
