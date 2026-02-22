import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { transactionSplits, transactions } from '@/lib/db/schema';
import {
  amountToCents,
  buildTransactionAmountFields,
} from '@/lib/transactions/money-movement-service';
import {
  findInvalidCategoryIds,
  findScopedTransaction,
  getSplitRouteContext,
  mapSplitRouteError,
} from '@/lib/transactions/transaction-split-route-shared';

export async function handleGetTransactionSplits(
  request: Request,
  transactionId: string
): Promise<Response> {
  try {
    const context = await getSplitRouteContext(request);
    const transaction = await findScopedTransaction(transactionId, context);

    if (!transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const splits = await db
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

    return Response.json(splits);
  } catch (error) {
    return mapSplitRouteError(error, 'Error fetching splits:');
  }
}

export async function handleCreateTransactionSplit(
  request: Request,
  transactionId: string
): Promise<Response> {
  try {
    const body = await request.json();
    const {
      categoryId,
      amount,
      description,
      isPercentage = false,
      notes,
      percentage,
      sortOrder = 0,
    } = body;

    const context = await getSplitRouteContext(request, body);

    if (!categoryId || (isPercentage && !percentage) || (!isPercentage && !amount)) {
      return Response.json(
        { error: 'Missing required fields (categoryId and amount or percentage)' },
        { status: 400 }
      );
    }

    const transaction = await findScopedTransaction(transactionId, context);
    if (!transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const invalidCategoryIds = await findInvalidCategoryIds([categoryId], context);
    if (invalidCategoryIds.length > 0) {
      return Response.json({ error: 'Category not found in household' }, { status: 404 });
    }

    const splitId = nanoid();
    const now = new Date().toISOString();
    const splitAmountCents = amountToCents(isPercentage ? 0 : amount);

    await db.insert(transactionSplits).values({
      id: splitId,
      userId: context.userId,
      householdId: context.householdId,
      transactionId,
      categoryId,
      ...buildTransactionAmountFields(splitAmountCents),
      percentage: isPercentage ? percentage : 0,
      isPercentage,
      description,
      notes,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });

    if (!transaction.isSplit) {
      await db
        .update(transactions)
        .set({
          isSplit: true,
          updatedAt: now,
        })
        .where(eq(transactions.id, transactionId));
    }

    const newSplit = await db
      .select()
      .from(transactionSplits)
      .where(eq(transactionSplits.id, splitId))
      .limit(1);

    return Response.json(newSplit[0], { status: 201 });
  } catch (error) {
    return mapSplitRouteError(error, 'Error creating split:');
  }
}
