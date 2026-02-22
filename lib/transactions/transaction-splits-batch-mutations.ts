import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { transactionSplits } from '@/lib/db/schema';
import type { BatchSplitRequest } from '@/lib/types';
import {
  amountToCents,
  buildTransactionAmountFields,
} from '@/lib/transactions/money-movement-service';
import { calculateSplitAmount } from '@/lib/transactions/transaction-split-route-shared';

type BatchSplitItem = BatchSplitRequest['splits'][number];

interface PartitionedSplits {
  toCreate: BatchSplitItem[];
  toDelete: { id: string }[];
  toUpdate: BatchSplitItem[];
}

export function partitionBatchSplits(
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

export async function applyDeletedBatchSplits(toDelete: { id: string }[]): Promise<number> {
  let deleted = 0;

  for (const split of toDelete) {
    await db.delete(transactionSplits).where(eq(transactionSplits.id, split.id));
    deleted++;
  }

  return deleted;
}

export async function applyCreatedBatchSplits(
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

export async function applyUpdatedBatchSplits(
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
