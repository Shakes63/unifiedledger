import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, budgetCategories } from '@/lib/db/schema';
import type { SearchFilters } from '@/lib/transactions/transaction-search-filters';

export async function resolveScopedIds(
  householdId: string,
  filters: SearchFilters
): Promise<{ invalidAccountIds: boolean; invalidCategoryIds: boolean; validAccountIds: string[]; validCategoryIds: string[] }> {
  let validCategoryIds: string[] = [];
  let validAccountIds: string[] = [];

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    const categoriesInHousehold = await db
      .select({ id: budgetCategories.id })
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.householdId, householdId),
          inArray(budgetCategories.id, filters.categoryIds)
        )
      );

    validCategoryIds = categoriesInHousehold.map((category) => category.id);
    if (validCategoryIds.length === 0) {
      return {
        validCategoryIds,
        validAccountIds,
        invalidCategoryIds: true,
        invalidAccountIds: false,
      };
    }
  }

  if (filters.accountIds && filters.accountIds.length > 0) {
    const accountsInHousehold = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          inArray(accounts.id, filters.accountIds)
        )
      );

    validAccountIds = accountsInHousehold.map((account) => account.id);
    if (validAccountIds.length === 0) {
      return {
        validCategoryIds,
        validAccountIds,
        invalidCategoryIds: false,
        invalidAccountIds: true,
      };
    }
  }

  return {
    validCategoryIds,
    validAccountIds,
    invalidCategoryIds: false,
    invalidAccountIds: false,
  };
}
