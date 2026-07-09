import { and, eq, gte, lte, sql, isNull, or } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions, transactionSplits } from '@/lib/db/schema';

/**
 * The single split-aware spending oracle for a category over a date range
 * (audit finding H-DBG-7). Every budget spending query previously summed
 * transactions.amountCents grouped by transactions.categoryId and ignored
 * transactionSplits entirely — so splitting a $300 "Groceries" expense into $100
 * Groceries / $200 Gas reported Groceries $300 and Gas $0.
 *
 * Split-category spend is the sum of:
 *   - NON-split transactions whose categoryId matches, plus
 *   - split ROWS whose categoryId matches, from a parent transaction of the same
 *     type in range (the parent's own categoryId no longer counts once it's
 *     split — parents carry isSplit = true).
 *
 * Returns integer cents. Scoping (userId optional) matches each caller so this
 * change is purely about split-awareness and doesn't alter user-vs-household
 * semantics.
 */
export async function getCategorySpendingCents(
  {
    categoryId,
    householdId,
    userId,
    startDate,
    endDate,
    categoryType,
  }: {
    categoryId: string;
    householdId: string;
    userId?: string;
    startDate: string;
    endDate: string;
    categoryType: string;
  },
  client: Pick<typeof db, 'select'> = db
): Promise<number> {
  const transactionType = categoryType === 'income' ? 'income' : 'expense';

  // Parent transactions in this category that are NOT split.
  const nonSplitConditions = [
    eq(transactions.householdId, householdId),
    eq(transactions.categoryId, categoryId),
    eq(transactions.type, transactionType),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
    // isSplit may be null on legacy rows; treat null as not-split.
    or(eq(transactions.isSplit, false), isNull(transactions.isSplit)),
  ];
  if (userId) nonSplitConditions.push(eq(transactions.userId, userId));

  const [nonSplit] = await client
    .select({ totalCents: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)` })
    .from(transactions)
    .where(and(...nonSplitConditions));

  // Split rows in this category, whose PARENT transaction is of the right type
  // and in range.
  const splitConditions = [
    eq(transactionSplits.householdId, householdId),
    eq(transactionSplits.categoryId, categoryId),
    eq(transactions.type, transactionType),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
  ];
  if (userId) splitConditions.push(eq(transactionSplits.userId, userId));

  const [split] = await client
    .select({ totalCents: sql<number>`COALESCE(SUM(${transactionSplits.amountCents}), 0)` })
    .from(transactionSplits)
    .innerJoin(transactions, eq(transactions.id, transactionSplits.transactionId))
    .where(and(...splitConditions));

  return (Number(nonSplit?.totalCents) || 0) + (Number(split?.totalCents) || 0);
}
