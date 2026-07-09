/**
 * Transaction search: request parsing, scope validation, filter/sort condition building, and execution.
 *
 * Consolidated from single-use shim files during the post-audit cleanup;
 * behavior is unchanged.
 */
import { and, eq, inArray, gte, like, lte, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  accounts,
  budgetCategories,
  transactions,
  transactionTags,
  searchHistory,
} from '@/lib/db/schema';
import { toMoneyCents } from '@/lib/utils/money-cents';
import { nanoid } from 'nanoid';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { apiDebugLog, handleRouteError } from '@/lib/api/route-helpers';
import { getCombinedTransferViewPreference } from '@/lib/preferences/transfer-view-preference';

// ---------------------------------------------------------------------------
// from transaction-search-filters.ts
// ---------------------------------------------------------------------------
const TRANSACTION_TYPES = ['income', 'expense', 'transfer_in', 'transfer_out'] as const;

type TransactionType = (typeof TRANSACTION_TYPES)[number];

interface SearchFilters {
  accountIds?: string[];
  amountMax?: number;
  amountMin?: number;
  categoryIds?: string[];
  customFieldIds?: string[];
  dateEnd?: string;
  dateStart?: string;
  hasNotes?: boolean;
  hasSavingsGoal?: boolean;
  isPending?: boolean;
  isSplit?: boolean;
  query?: string;
  sortBy?: 'amount' | 'date' | 'description';
  sortOrder?: 'asc' | 'desc';
  tagIds?: string[];
  types?: string[];
}

interface ParsedSearchRequest {
  filters: SearchFilters;
  limit: number;
  offset: number;
}

interface TransactionSearchResponsePayload {
  metadata: {
    appliedFilters: SearchFilters;
    executionTimeMs: number;
    filtersApplied: boolean;
  };
  pagination: {
    hasMore: boolean;
    limit: number;
    offset: number;
    total: number;
  };
  transactions: unknown[];
}

function isTransactionType(value: string): value is TransactionType {
  return (TRANSACTION_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// from transaction-search-request.ts
// ---------------------------------------------------------------------------
function parseTransactionSearchRequest(request: Request): ParsedSearchRequest {
  const url = new URL(request.url);

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const filters: SearchFilters = {
    sortBy: (url.searchParams.get('sortBy') || 'date') as 'amount' | 'date' | 'description',
    sortOrder: (url.searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
  };

  const query = url.searchParams.get('query');
  if (query) filters.query = query;

  const categoryIds = url.searchParams.get('categoryIds');
  if (categoryIds) filters.categoryIds = categoryIds.split(',').filter(Boolean);

  const accountIds = url.searchParams.get('accountIds');
  if (accountIds) filters.accountIds = accountIds.split(',').filter(Boolean);

  const tagIds = url.searchParams.get('tagIds');
  if (tagIds) filters.tagIds = tagIds.split(',').filter(Boolean);

  const customFieldIds = url.searchParams.get('customFieldIds');
  if (customFieldIds) filters.customFieldIds = customFieldIds.split(',').filter(Boolean);

  const types = url.searchParams.get('types');
  if (types) filters.types = types.split(',').filter(Boolean);

  const amountMin = url.searchParams.get('amountMin');
  if (amountMin !== null) {
    const parsedAmountMin = parseFloat(amountMin);
    if (!Number.isNaN(parsedAmountMin)) filters.amountMin = parsedAmountMin;
  }

  const amountMax = url.searchParams.get('amountMax');
  if (amountMax !== null) {
    const parsedAmountMax = parseFloat(amountMax);
    if (!Number.isNaN(parsedAmountMax)) filters.amountMax = parsedAmountMax;
  }

  const dateStart = url.searchParams.get('dateStart');
  if (dateStart) filters.dateStart = dateStart;

  const dateEnd = url.searchParams.get('dateEnd');
  if (dateEnd) filters.dateEnd = dateEnd;

  const isPending = url.searchParams.get('isPending');
  if (isPending !== null) filters.isPending = isPending === 'true';

  const isSplit = url.searchParams.get('isSplit');
  if (isSplit !== null) filters.isSplit = isSplit === 'true';

  const hasNotes = url.searchParams.get('hasNotes');
  if (hasNotes !== null) filters.hasNotes = hasNotes === 'true';

  const hasSavingsGoal = url.searchParams.get('hasSavingsGoal');
  if (hasSavingsGoal !== null) filters.hasSavingsGoal = hasSavingsGoal === 'true';

  return {
    limit,
    offset,
    filters,
  };
}

function buildEmptySearchResponse(
  filters: SearchFilters,
  limit: number,
  offset: number
): TransactionSearchResponsePayload {
  return {
    transactions: [],
    pagination: {
      limit,
      offset,
      total: 0,
      hasMore: false,
    },
    metadata: {
      executionTimeMs: 0,
      filtersApplied: true,
      appliedFilters: filters,
    },
  };
}

// ---------------------------------------------------------------------------
// from transaction-search-scope-validation.ts
// ---------------------------------------------------------------------------
async function resolveScopedIds(
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

// ---------------------------------------------------------------------------
// from transaction-search-conditions.ts
// ---------------------------------------------------------------------------
function buildTransactionSearchConditions(
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

// ---------------------------------------------------------------------------
// from transaction-search-sort.ts
// ---------------------------------------------------------------------------
interface SortableQuery<T> {
  where: (condition: unknown) => SortableQuery<T>;
  orderBy: (...args: unknown[]) => SortableQuery<T>;
  limit: (value: number) => SortableQuery<T>;
  offset: (value: number) => Promise<T[]>;
}

function applySearchSort<T>(query: SortableQuery<T>, filters: SearchFilters): SortableQuery<T> {
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

// ---------------------------------------------------------------------------
// from transaction-search-execution.ts
// ---------------------------------------------------------------------------
interface TransactionSearchExecutionResult {
  results: typeof transactions.$inferSelect[];
  totalCount: number;
}

type JoinedTransactionRow = { transactions: typeof transactions.$inferSelect };

async function executeTransactionSearch(
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
      joinQuery as unknown as SortableQuery<JoinedTransactionRow>,
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
    baseQuery as unknown as SortableQuery<typeof transactions.$inferSelect>,
    filters
  );

  const results = await sortedBaseQuery.limit(limit).offset(offset);

  return {
    totalCount: countResult[0]?.count || 0,
    results,
  };
}

// ---------------------------------------------------------------------------
// from transaction-search-route-handler.ts
// ---------------------------------------------------------------------------
export async function handleTransactionSearch(request: Request): Promise<Response> {
  try {
    const startTime = performance.now();
    const { userId } = await requireAuth();
    const { filters, limit, offset } = parseTransactionSearchRequest(request);
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return Response.json({ error: 'Household ID is required' }, { status: 400 });
    }

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
