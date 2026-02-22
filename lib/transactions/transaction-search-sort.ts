import { sql } from 'drizzle-orm';

import { transactions } from '@/lib/db/schema';
import type { SearchFilters } from '@/lib/transactions/transaction-search-filters';

export interface SortableQuery<T> {
  where: (condition: unknown) => SortableQuery<T>;
  orderBy: (...args: unknown[]) => SortableQuery<T>;
  limit: (value: number) => SortableQuery<T>;
  offset: (value: number) => Promise<T[]>;
}

export function applySearchSort<T>(query: SortableQuery<T>, filters: SearchFilters): SortableQuery<T> {
  if (filters.sortBy === 'amount') {
    return query.orderBy(
      filters.sortOrder === 'asc'
        ? transactions.amountCents
        : sql`${transactions.amountCents} DESC`
    );
  }

  if (filters.sortBy === 'description') {
    return query.orderBy(
      filters.sortOrder === 'asc'
        ? transactions.description
        : sql`${transactions.description} DESC`
    );
  }

  return query.orderBy(
    filters.sortOrder === 'asc' ? transactions.date : sql`${transactions.date} DESC`
  );
}
