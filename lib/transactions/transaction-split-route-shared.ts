import Decimal from 'decimal.js';
import { and, eq, inArray } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { handleRouteError } from '@/lib/api/route-helpers';
import { db } from '@/lib/db';
import { budgetCategories, transactions, transactionSplits } from '@/lib/db/schema';

export interface SplitRouteContext {
  householdId: string;
  userId: string;
}

export interface SplitUpdateData {
  categoryId?: string;
  description?: string | null;
  isPercentage?: boolean;
  notes?: string | null;
  percentage?: number;
  sortOrder?: number;
  updatedAt: string;
  amount?: number;
  amountCents?: number;
}

export async function getSplitRouteContext(
  request: Request,
  body?: { householdId?: string }
): Promise<SplitRouteContext> {
  const { userId } = await requireAuth();
  const { householdId } = await getAndVerifyHousehold(request, userId, body);

  return {
    userId,
    householdId,
  };
}

export function mapSplitRouteError(error: unknown, logLabel: string): Response {
  return handleRouteError(error, {
    defaultError: 'Internal server error',
    logLabel,
  });
}

export async function findScopedTransaction(
  transactionId: string,
  context: SplitRouteContext
): Promise<(typeof transactions.$inferSelect) | null> {
  const result = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, context.userId),
        eq(transactions.householdId, context.householdId)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

export async function findScopedSplit(
  splitId: string,
  transactionId: string,
  context: SplitRouteContext
): Promise<{ id: string } | null> {
  const result = await db
    .select({ id: transactionSplits.id })
    .from(transactionSplits)
    .where(
      and(
        eq(transactionSplits.id, splitId),
        eq(transactionSplits.transactionId, transactionId),
        eq(transactionSplits.userId, context.userId),
        eq(transactionSplits.householdId, context.householdId)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

export async function findInvalidCategoryIds(
  categoryIds: string[],
  context: SplitRouteContext
): Promise<string[]> {
  if (categoryIds.length === 0) {
    return [];
  }

  const validCategories = await db
    .select({ id: budgetCategories.id })
    .from(budgetCategories)
    .where(
      and(
        inArray(budgetCategories.id, categoryIds),
        eq(budgetCategories.userId, context.userId),
        eq(budgetCategories.householdId, context.householdId)
      )
    );

  const validIds = new Set(validCategories.map((category) => category.id));
  return categoryIds.filter((categoryId) => !validIds.has(categoryId));
}

export function calculateSplitAmount(
  transactionAmount: number,
  amount: number | undefined,
  isPercentage: boolean,
  percentage: number | undefined
): number {
  if (!isPercentage) {
    return amount ?? 0;
  }

  if (!percentage) {
    return 0;
  }

  return new Decimal(transactionAmount)
    .times(percentage)
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}
