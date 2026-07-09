/**
 * Batch split route: atomic multi-transaction split replacement.
 *
 * Consolidated from single-use shim files during the post-audit cleanup;
 * behavior is unchanged.
 */
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { transactionSplits, transactions } from '@/lib/db/schema';
import {
  type BatchSplitRequest,
  type BatchSplitResponse,
  type TransactionSplit,
} from '@/lib/types';
import {
  amountToCents,
  buildTransactionAmountFields,
} from '@/lib/transactions/money-movement-service';
import {
  calculateSplitAmount,
  findInvalidCategoryIds,
  findScopedTransaction,
  getSplitRouteContext,
  mapSplitRouteError,
} from '@/lib/transactions/transaction-split-route-shared';
import { validateBatchSplits, type BatchSplitItem } from '@/lib/transactions/split-calculator';

// ---------------------------------------------------------------------------
// from transaction-splits-batch-mutations.ts
// ---------------------------------------------------------------------------

interface PartitionedSplits {
  toCreate: BatchSplitItem[];
  toDelete: { id: string }[];
  toUpdate: BatchSplitItem[];
}

function partitionBatchSplits(
  incomingSplits: BatchSplitItem[],
  existingSplits: { id: string }[],
  deleteOthers: boolean
): PartitionedSplits {
  const existingSplitIds = new Set(existingSplits.map((split) => split.id));
  const incomingSplitIds = new Set(
    incomingSplits.filter((split) => split.id).map((split) => split.id as string)
  );

  return {
    toCreate: incomingSplits.filter((split) => !split.id || !existingSplitIds.has(split.id)),
    toUpdate: incomingSplits.filter((split) => split.id && existingSplitIds.has(split.id)),
    toDelete: deleteOthers
      ? existingSplits.filter((split) => !incomingSplitIds.has(split.id))
      : [],
  };
}

async function applyDeletedBatchSplits(toDelete: { id: string }[]): Promise<number> {
  let deleted = 0;

  for (const split of toDelete) {
    await db.delete(transactionSplits).where(eq(transactionSplits.id, split.id));
    deleted++;
  }

  return deleted;
}

async function applyCreatedBatchSplits(
  toCreate: BatchSplitItem[],
  context: { householdId: string; userId: string },
  transactionId: string,
  transactionAmount: number,
  now: string
): Promise<number> {
  let created = 0;

  for (let index = 0; index < toCreate.length; index++) {
    const split = toCreate[index];
    const finalAmount = calculateSplitAmount(
      transactionAmount,
      split.amount,
      split.isPercentage,
      split.percentage
    );

    await db.insert(transactionSplits).values({
      id: nanoid(),
      userId: context.userId,
      householdId: context.householdId,
      transactionId,
      categoryId: split.categoryId,
      ...buildTransactionAmountFields(amountToCents(finalAmount)),
      percentage: split.isPercentage ? (split.percentage ?? 0) : 0,
      isPercentage: split.isPercentage,
      description: split.description ?? null,
      notes: split.notes ?? null,
      sortOrder: split.sortOrder ?? index,
      createdAt: now,
      updatedAt: now,
    });
    created++;
  }

  return created;
}

async function applyUpdatedBatchSplits(
  toUpdate: BatchSplitItem[],
  transactionAmount: number,
  now: string
): Promise<number> {
  let updated = 0;

  for (const split of toUpdate) {
    const finalAmount = calculateSplitAmount(
      transactionAmount,
      split.amount,
      split.isPercentage,
      split.percentage
    );

    await db
      .update(transactionSplits)
      .set({
        categoryId: split.categoryId,
        ...buildTransactionAmountFields(amountToCents(finalAmount)),
        percentage: split.isPercentage ? (split.percentage ?? 0) : 0,
        isPercentage: split.isPercentage,
        description: split.description ?? null,
        notes: split.notes ?? null,
        sortOrder: split.sortOrder ?? 0,
        updatedAt: now,
      })
      .where(eq(transactionSplits.id, split.id as string));
    updated++;
  }

  return updated;
}

// ---------------------------------------------------------------------------
// from transaction-splits-batch-route-handler.ts
// ---------------------------------------------------------------------------
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
