import { nanoid } from 'nanoid';

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { apiDebugLog, handleRouteError } from '@/lib/api/route-helpers';
import { db } from '@/lib/db';
import { searchHistory } from '@/lib/db/schema';
import { getCombinedTransferViewPreference } from '@/lib/preferences/transfer-view-preference';
import {
  type SearchFilters,
} from '@/lib/transactions/transaction-search-filters';
import {
  buildEmptySearchResponse,
  parseTransactionSearchRequest,
} from '@/lib/transactions/transaction-search-request';
import {
  buildTransactionSearchConditions,
} from '@/lib/transactions/transaction-search-conditions';
import { executeTransactionSearch } from '@/lib/transactions/transaction-search-execution';
import { resolveScopedIds } from '@/lib/transactions/transaction-search-scope-validation';

export async function handleTransactionSearch(request: Request): Promise<Response> {
  try {
    const startTime = performance.now();
    const { userId } = await requireAuth();
    const { filters, limit, offset } = parseTransactionSearchRequest(request);
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    const shouldUseCombinedTransferFilter =
      (!filters.accountIds || filters.accountIds.length === 0) &&
      (await getCombinedTransferViewPreference(userId, householdId));

    const scopedIds = await resolveScopedIds(householdId, filters);
    if (scopedIds.invalidCategoryIds || scopedIds.invalidAccountIds) {
      return Response.json(buildEmptySearchResponse(filters, limit, offset));
    }

    const conditions = buildTransactionSearchConditions(
      userId,
      householdId,
      filters,
      shouldUseCombinedTransferFilter,
      scopedIds.validCategoryIds,
      scopedIds.validAccountIds
    );

    const { results, totalCount } = await executeTransactionSearch(filters, conditions, limit, offset);
    const executionTimeMs = Math.round(performance.now() - startTime);

    try {
      await db.insert(searchHistory).values({
        id: nanoid(),
        userId,
        filters: JSON.stringify(filters),
        resultCount: totalCount,
        executionTimeMs,
        executedAt: new Date().toISOString(),
      });
    } catch (error) {
      apiDebugLog('transactions:search', 'Error tracking search history', error);
    }

    return Response.json({
      transactions: results,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
      metadata: {
        executionTimeMs,
        filtersApplied: hasAnySearchFilters(filters),
        appliedFilters: filters,
      },
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction search error:',
      includeErrorDetails: true,
    });
  }
}

function hasAnySearchFilters(filters: SearchFilters): boolean {
  return Object.keys(filters).length > 0;
}
