import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, transactionSplits, budgetCategories } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { validateBatchSplits, type BatchSplitItem } from '@/lib/transactions/split-calculator';
import type { BatchSplitRequest, BatchSplitResponse, TransactionSplit } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/transactions/[id]/splits/batch
 * 
 * Batch update splits for a transaction.
 * Creates, updates, and deletes splits in a single atomic operation.
 * 
 * Request body:
 * {
 *   splits: Array<{
 *     id?: string;           // If present, update; if absent, create
 *     categoryId: string;
 *     amount?: number;
 *     percentage?: number;
 *     isPercentage: boolean;
 *     description?: string;
 *     notes?: string;
 *     sortOrder?: number;
 *   }>;
 *   deleteOthers?: boolean;  // If true (default), delete splits not in the array
 * }
 * 
 * Response:
 * {
 *   created: number;
 *   updated: number;
 *   deleted: number;
 *   splits: TransactionSplit[];
 * }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transactionId } = await params;
  
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { splits: incomingSplits, deleteOthers = true } = body as BatchSplitRequest;

    // Validate request body
    if (!Array.isArray(incomingSplits)) {
      return Response.json(
        { error: 'splits must be an array' },
        { status: 400 }
      );
    }

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Verify transaction exists and belongs to user AND household
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

    const transactionAmount = transaction[0]!.amount;

    // Validate all splits before making any changes
    if (incomingSplits.length > 0) {
      const batchItems: BatchSplitItem[] = incomingSplits.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        amount: s.amount,
        percentage: s.percentage,
        isPercentage: s.isPercentage,
        description: s.description,
        notes: s.notes,
        sortOrder: s.sortOrder,
      }));

      const validation = validateBatchSplits(batchItems, transactionAmount);
      if (!validation.valid) {
        return Response.json(
          { error: validation.error },
          { status: 400 }
        );
      }
    }

    // Validate all category IDs belong to household
    const categoryIds = [...new Set(incomingSplits.map((s) => s.categoryId).filter(Boolean))];
    if (categoryIds.length > 0) {
      const validCategories = await db
        .select({ id: budgetCategories.id })
        .from(budgetCategories)
        .where(
          and(
            inArray(budgetCategories.id, categoryIds),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
          )
        );

      const validCategoryIds = new Set(validCategories.map((c) => c.id));
      const invalidCategoryIds = categoryIds.filter((id) => !validCategoryIds.has(id));

      if (invalidCategoryIds.length > 0) {
        return Response.json(
          { error: `Invalid category IDs: ${invalidCategoryIds.join(', ')}` },
          { status: 404 }
        );
      }
    }

    // Get current splits for this transaction
    const existingSplits = await db
      .select()
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, userId),
          eq(transactionSplits.householdId, householdId)
        )
      );

    const existingSplitIds = new Set(existingSplits.map((s) => s.id));
    const incomingSplitIds = new Set(
      incomingSplits.filter((s) => s.id).map((s) => s.id!)
    );

    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Determine which splits to create, update, and delete
    const toCreate = incomingSplits.filter((s) => !s.id || !existingSplitIds.has(s.id));
    const toUpdate = incomingSplits.filter((s) => s.id && existingSplitIds.has(s.id));
    const toDelete = deleteOthers
      ? existingSplits.filter((s) => !incomingSplitIds.has(s.id))
      : [];

    // Perform deletes
    for (const split of toDelete) {
      await db
        .delete(transactionSplits)
        .where(eq(transactionSplits.id, split.id));
      deleted++;
    }

    // Perform creates
    for (let i = 0; i < toCreate.length; i++) {
      const split = toCreate[i];
      const splitId = nanoid();
      const sortOrder = split.sortOrder ?? i;

      // Calculate amount if percentage-based, round to 2 decimal places
      let finalAmount = split.amount ?? 0;
      if (split.isPercentage && split.percentage) {
        finalAmount = new Decimal(transactionAmount)
          .times(split.percentage)
          .dividedBy(100)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
      }

      await db.insert(transactionSplits).values({
        id: splitId,
        userId,
        householdId,
        transactionId,
        categoryId: split.categoryId,
        amount: finalAmount,
        percentage: split.isPercentage ? (split.percentage ?? 0) : 0,
        isPercentage: split.isPercentage,
        description: split.description ?? null,
        notes: split.notes ?? null,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }

    // Perform updates
    for (const split of toUpdate) {
      // Calculate amount if percentage-based, round to 2 decimal places
      let finalAmount = split.amount ?? 0;
      if (split.isPercentage && split.percentage) {
        finalAmount = new Decimal(transactionAmount)
          .times(split.percentage)
          .dividedBy(100)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
      }

      await db
        .update(transactionSplits)
        .set({
          categoryId: split.categoryId,
          amount: finalAmount,
          percentage: split.isPercentage ? (split.percentage ?? 0) : 0,
          isPercentage: split.isPercentage,
          description: split.description ?? null,
          notes: split.notes ?? null,
          sortOrder: split.sortOrder ?? 0,
          updatedAt: now,
        })
        .where(eq(transactionSplits.id, split.id!));
      updated++;
    }

    // Update parent transaction's isSplit flag
    const remainingSplitCount = incomingSplits.length;
    const shouldBeSplit = remainingSplitCount > 0;
    const currentIsSplit = transaction[0]!.isSplit;

    if (shouldBeSplit !== currentIsSplit) {
      await db
        .update(transactions)
        .set({
          isSplit: shouldBeSplit,
          updatedAt: now,
        })
        .where(eq(transactions.id, transactionId));
    }

    // Fetch final state of all splits
    const finalSplits = await db
      .select()
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, userId),
          eq(transactionSplits.householdId, householdId)
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (
      error instanceof Error &&
      (error.message.includes('Household') || error.message.includes('member'))
    ) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error in batch split update:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

