import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions, transactionSplits } from '@/lib/db/schema';
import type { BatchSplitRequest, BatchSplitResponse, TransactionSplit } from '@/lib/types';
import { validateBatchSplits, type BatchSplitItem } from '@/lib/transactions/split-calculator';
import {
  findInvalidCategoryIds,
  findScopedTransaction,
  getSplitRouteContext,
  mapSplitRouteError,
} from '@/lib/transactions/transaction-split-route-shared';
import {
  applyCreatedBatchSplits,
  applyDeletedBatchSplits,
  applyUpdatedBatchSplits,
  partitionBatchSplits,
} from '@/lib/transactions/transaction-splits-batch-mutations';

export async function handleBatchUpdateTransactionSplits(
  request: Request,
  transactionId: string
): Promise<Response> {
  try {
    const body = await request.json();
    const { deleteOthers = true, splits: incomingSplits } = body as BatchSplitRequest;

    if (!Array.isArray(incomingSplits)) {
      return Response.json({ error: 'splits must be an array' }, { status: 400 });
    }

    const context = await getSplitRouteContext(request, body);
    const transaction = await findScopedTransaction(transactionId, context);

    if (!transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (incomingSplits.length > 0) {
      const batchItems: BatchSplitItem[] = incomingSplits.map((split) => ({
        id: split.id,
        categoryId: split.categoryId,
        amount: split.amount,
        percentage: split.percentage,
        isPercentage: split.isPercentage,
        description: split.description,
        notes: split.notes,
        sortOrder: split.sortOrder,
      }));

      const validation = validateBatchSplits(batchItems, transaction.amount);
      if (!validation.valid) {
        return Response.json({ error: validation.error }, { status: 400 });
      }
    }

    const uniqueCategoryIds = [...new Set(incomingSplits.map((split) => split.categoryId).filter(Boolean))];
    const invalidCategoryIds = await findInvalidCategoryIds(uniqueCategoryIds, context);
    if (invalidCategoryIds.length > 0) {
      return Response.json(
        { error: `Invalid category IDs: ${invalidCategoryIds.join(', ')}` },
        { status: 404 }
      );
    }

    const existingSplits = await db
      .select({ id: transactionSplits.id })
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, context.userId),
          eq(transactionSplits.householdId, context.householdId)
        )
      );

    const { toCreate, toDelete, toUpdate } = partitionBatchSplits(
      incomingSplits,
      existingSplits,
      deleteOthers
    );

    const now = new Date().toISOString();
    const deleted = await applyDeletedBatchSplits(toDelete);
    const created = await applyCreatedBatchSplits(
      toCreate,
      context,
      transactionId,
      transaction.amount,
      now
    );
    const updated = await applyUpdatedBatchSplits(toUpdate, transaction.amount, now);

    const shouldBeSplit = incomingSplits.length > 0;
    if (shouldBeSplit !== transaction.isSplit) {
      await db
        .update(transactions)
        .set({
          isSplit: shouldBeSplit,
          updatedAt: now,
        })
        .where(eq(transactions.id, transactionId));
    }

    const finalSplits = await db
      .select()
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, context.userId),
          eq(transactionSplits.householdId, context.householdId)
        )
      )
      .orderBy(transactionSplits.sortOrder);

    const response: BatchSplitResponse = {
      created,
      updated,
      deleted,
      splits: finalSplits as TransactionSplit[],
    };

    return Response.json(response);
  } catch (error) {
    return mapSplitRouteError(error, 'Error in batch split update:');
  }
}
