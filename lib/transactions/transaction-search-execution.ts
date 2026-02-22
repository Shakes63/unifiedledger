import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions, transactionTags } from '@/lib/db/schema';
import {
  type SearchFilters,
} from '@/lib/transactions/transaction-search-filters';
import { applySearchSort } from '@/lib/transactions/transaction-search-sort';

interface TransactionSearchExecutionResult {
  results: typeof transactions.$inferSelect[];
  totalCount: number;
}

export async function executeTransactionSearch(
  filters: SearchFilters,
  conditions: SQL[],
  limit: number,
  offset: number
): Promise<TransactionSearchExecutionResult> {
  if (filters.tagIds && filters.tagIds.length > 0) {
    const countResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${transactions.id})` })
      .from(transactions)
      .innerJoin(transactionTags, eq(transactions.id, transactionTags.transactionId))
      .where(and(...conditions, inArray(transactionTags.tagId, filters.tagIds)));

    const joinQuery = db
      .selectDistinct()
      .from(transactions)
      .innerJoin(transactionTags, eq(transactions.id, transactionTags.transactionId))
      .where(and(...conditions, inArray(transactionTags.tagId, filters.tagIds)));

    const sortedJoinQuery = applySearchSort(
      joinQuery as unknown as {
        where: (condition: unknown) => unknown;
        orderBy: (...args: unknown[]) => unknown;
        limit: (value: number) => { offset: (value: number) => Promise<{ transactions: typeof transactions.$inferSelect }[]> };
      },
      filters
    );

    const joinResults = await sortedJoinQuery.limit(limit).offset(offset);

    return {
      totalCount: countResult[0]?.count || 0,
      results: joinResults.map((row) => row.transactions),
    };
  }

  const countResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${transactions.id})` })
    .from(transactions)
    .where(and(...conditions));

  const baseQuery = db.select().from(transactions).where(and(...conditions));
  const sortedBaseQuery = applySearchSort(
    baseQuery as unknown as {
      where: (condition: unknown) => unknown;
      orderBy: (...args: unknown[]) => unknown;
      limit: (value: number) => { offset: (value: number) => Promise<(typeof transactions.$inferSelect)[]> };
    },
    filters
  );

  const results = await sortedBaseQuery.limit(limit).offset(offset);

  return {
    totalCount: countResult[0]?.count || 0,
    results,
  };
}
