import { eq, gte, inArray, like, lte, or, sql, type SQL } from 'drizzle-orm';

import { transactions } from '@/lib/db/schema';
import {
  isTransactionType,
  type SearchFilters,
} from '@/lib/transactions/transaction-search-filters';
import { toMoneyCents } from '@/lib/utils/money-cents';

export function buildTransactionSearchConditions(
  userId: string,
  householdId: string,
  filters: SearchFilters,
  shouldUseCombinedTransferFilter: boolean,
  validCategoryIds: string[],
  validAccountIds: string[]
): SQL[] {
  const conditions: SQL[] = [
    eq(transactions.userId, userId),
    eq(transactions.householdId, householdId),
  ];

  if (shouldUseCombinedTransferFilter) {
    conditions.push(sql`${transactions.type} != 'transfer_in'`);
  }

  if (filters.query) {
    const searchPattern = `%${filters.query}%`;
    conditions.push(or(like(transactions.description, searchPattern), like(transactions.notes, searchPattern))!);
  }

  if (validCategoryIds.length > 0) {
    conditions.push(inArray(transactions.categoryId, validCategoryIds));
  }

  if (validAccountIds.length > 0) {
    conditions.push(inArray(transactions.accountId, validAccountIds));
  }

  if (filters.types && filters.types.length > 0) {
    const typeValues = filters.types.filter(isTransactionType);
    if (typeValues.length > 0) {
      conditions.push(inArray(transactions.type, typeValues));
    }
  }

  if (filters.amountMin !== undefined) {
    conditions.push(gte(transactions.amountCents, toMoneyCents(filters.amountMin) ?? 0));
  }

  if (filters.amountMax !== undefined) {
    conditions.push(lte(transactions.amountCents, toMoneyCents(filters.amountMax) ?? 0));
  }

  if (filters.dateStart) {
    conditions.push(gte(transactions.date, filters.dateStart));
  }

  if (filters.dateEnd) {
    conditions.push(lte(transactions.date, filters.dateEnd));
  }

  if (filters.isPending !== undefined) {
    conditions.push(eq(transactions.isPending, filters.isPending));
  }

  if (filters.isSplit !== undefined) {
    conditions.push(eq(transactions.isSplit, filters.isSplit));
  }

  if (filters.hasNotes !== undefined) {
    if (filters.hasNotes) {
      conditions.push(sql`${transactions.notes} IS NOT NULL AND ${transactions.notes} != ''`);
    } else {
      conditions.push(sql`${transactions.notes} IS NULL OR ${transactions.notes} = ''`);
    }
  }

  if (filters.hasSavingsGoal !== undefined) {
    if (filters.hasSavingsGoal) {
      conditions.push(sql`${transactions.savingsGoalId} IS NOT NULL`);
    } else {
      conditions.push(sql`${transactions.savingsGoalId} IS NULL`);
    }
  }

  return conditions;
}
