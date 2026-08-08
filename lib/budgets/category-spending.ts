import { and, eq, gte, lte, sql, isNull, or, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions, transactionSplits } from '@/lib/db/schema';

/**
 * The single split-aware spending oracle for a category over a date range
 * (audit finding H-DBG-7). Every budget spending query previously summed
 * transactions.amountCents grouped by transactions.categoryId and ignored
 * transactionSplits entirely — so splitting a $300 "Groceries" expense into $100
 * Groceries / $200 Gas reported Groceries $300 and Gas $0.
 *
 * Category spend is the sum of:
 *   - NON-split transactions whose categoryId matches, plus
 *   - split ROWS whose categoryId matches, from a parent transaction of the
 *     right type in range (the parent's own categoryId no longer counts once
 *     it's split — parents carry isSplit = true), plus
 *   - the UNCOVERED REMAINDER of a partially-split parent in this category
 *     (bug-hunt finding M4): the split endpoints allow splits that don't cover
 *     the parent while still flagging it isSplit, so the difference used to
 *     vanish from every budget total and got credited back as rollover surplus,
 *   - MINUS refunds booked against the category (finding M2): a refund is
 *     stored as type 'income' with isRefund = true while keeping the user's
 *     EXPENSE category, so it never reduced spending and was double-counted as
 *     income elsewhere.
 *
 * For expense categories, `transfer_out` counts as spending alongside `expense`
 * (finding R5) — a category funded by transfers (savings, card payments) was
 * otherwise seen as $0 spent, so rollover credited its entire budget as surplus
 * every month, forever. This matches the convention already used by
 * /api/budget-groups.
 *
 * Returns integer cents (never negative). Scoping (userId optional) matches each
 * caller.
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
  const isIncomeCategory = categoryType === 'income';
  // Money leaving the household for an expense category is either a plain
  // expense or a categorized transfer out.
  const spendTypes: Array<'income' | 'expense' | 'transfer_out'> = isIncomeCategory
    ? ['income']
    : ['expense', 'transfer_out'];

  const dateInRange = [gte(transactions.date, startDate), lte(transactions.date, endDate)];

  // Parent transactions in this category that are NOT split.
  const nonSplitConditions = [
    eq(transactions.householdId, householdId),
    eq(transactions.categoryId, categoryId),
    inArray(transactions.type, spendTypes),
    ...dateInRange,
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
    inArray(transactions.type, spendTypes),
    ...dateInRange,
  ];
  if (userId) splitConditions.push(eq(transactionSplits.userId, userId));

  const [split] = await client
    .select({ totalCents: sql<number>`COALESCE(SUM(${transactionSplits.amountCents}), 0)` })
    .from(transactionSplits)
    .innerJoin(transactions, eq(transactions.id, transactionSplits.transactionId))
    .where(and(...splitConditions));

  // Uncovered remainder of partially-split parents in this category (M4).
  // Done as two plain queries rather than a correlated subquery so the
  // per-parent arithmetic is explicit and dialect-independent.
  const remainderConditions = [
    eq(transactions.householdId, householdId),
    eq(transactions.categoryId, categoryId),
    inArray(transactions.type, spendTypes),
    ...dateInRange,
    eq(transactions.isSplit, true),
  ];
  if (userId) remainderConditions.push(eq(transactions.userId, userId));

  const splitParents = await client
    .select({ id: transactions.id, amountCents: transactions.amountCents })
    .from(transactions)
    .where(and(...remainderConditions));

  let remainderCents = 0;
  if (splitParents.length > 0) {
    const coverage = await client
      .select({
        transactionId: transactionSplits.transactionId,
        coveredCents: sql<number>`COALESCE(SUM(${transactionSplits.amountCents}), 0)`,
      })
      .from(transactionSplits)
      .where(
        inArray(
          transactionSplits.transactionId,
          splitParents.map((parent) => parent.id)
        )
      )
      .groupBy(transactionSplits.transactionId);

    const coveredByParent = new Map(
      coverage.map((row) => [row.transactionId, Number(row.coveredCents) || 0])
    );
    for (const parent of splitParents) {
      const parentCents = Number(parent.amountCents) || 0;
      remainderCents += Math.max(0, parentCents - (coveredByParent.get(parent.id) ?? 0));
    }
  }

  // Refunds booked against an EXPENSE category reduce its spending (M2).
  let refundCents = 0;
  if (!isIncomeCategory) {
    const refundConditions = [
      eq(transactions.householdId, householdId),
      eq(transactions.categoryId, categoryId),
      eq(transactions.type, 'income'),
      eq(transactions.isRefund, true),
      ...dateInRange,
    ];
    if (userId) refundConditions.push(eq(transactions.userId, userId));

    const [refunds] = await client
      .select({ totalCents: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)` })
      .from(transactions)
      .where(and(...refundConditions));
    refundCents = Number(refunds?.totalCents) || 0;
  }

  const spent =
    (Number(nonSplit?.totalCents) || 0) +
    (Number(split?.totalCents) || 0) +
    remainderCents -
    refundCents;

  // A category refunded more than it spent reads as $0 spent, not negative.
  return Math.max(0, spent);
}
