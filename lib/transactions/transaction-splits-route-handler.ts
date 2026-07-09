import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

import { db } from '@/lib/db';
import { transactionSplits, transactions } from '@/lib/db/schema';
import {
  amountToCents,
  buildTransactionAmountFields,
  getTransactionAmountCents,
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

    // Compute the real cents amount. Percentage splits were previously stored
    // with amountCents = 0, so any consumer summing split cents saw $0 (H-TXN-6);
    // materialize the amount from the parent like the batch path does.
    const parentAmountCents = getTransactionAmountCents(transaction);
    const splitAmountCents = isPercentage
      ? new Decimal(parentAmountCents)
          .times(percentage)
          .dividedBy(100)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toNumber()
      : amountToCents(amount);

    if (splitAmountCents <= 0) {
      return Response.json({ error: 'Split amount must be greater than 0' }, { status: 400 });
    }

    // Reject a split (or set of splits) that would exceed the parent amount.
    const existingSplits = await db
      .select({ amountCents: transactionSplits.amountCents })
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, context.userId),
          eq(transactionSplits.householdId, context.householdId)
        )
      );
    const existingSum = existingSplits.reduce(
      (sum, split) => sum + (Number(split.amountCents) || 0),
      0
    );
    if (existingSum + splitAmountCents > Math.abs(parentAmountCents)) {
      return Response.json(
        { error: 'Splits would exceed the transaction amount' },
        { status: 400 }
      );
    }

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
