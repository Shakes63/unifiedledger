import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, searchHistory, transactionTags, customFieldValues, accounts, budgetCategories } from '@/lib/db/schema';
import { eq, and, or, gte, lte, like, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

interface SearchFilters {
  query?: string;
  categoryIds?: string[];
  accountIds?: string[];
  tagIds?: string[];
  customFieldIds?: string[];
  types?: string[];
  amountMin?: number;
  amountMax?: number;
  dateStart?: string;
  dateEnd?: string;
  isPending?: boolean;
  isSplit?: boolean;
  hasNotes?: boolean;
  sortBy?: 'date' | 'amount' | 'description';
  sortOrder?: 'asc' | 'desc';
}

export async function GET(request: Request) {
  try {
    const startTime = performance.now();
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
  );
}

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const query = url.searchParams.get('query') || undefined;
    const categoryIdsStr = url.searchParams.get('categoryIds');
    const accountIdsStr = url.searchParams.get('accountIds');
    const tagIdsStr = url.searchParams.get('tagIds');
    const customFieldIdsStr = url.searchParams.get('customFieldIds');
    const typesStr = url.searchParams.get('types');
    const amountMin = url.searchParams.get('amountMin');
    const amountMax = url.searchParams.get('amountMax');
    const dateStart = url.searchParams.get('dateStart');
    const dateEnd = url.searchParams.get('dateEnd');
    const isPending = url.searchParams.get('isPending');
    const isSplit = url.searchParams.get('isSplit');
    const hasNotes = url.searchParams.get('hasNotes');
    const sortBy = (url.searchParams.get('sortBy') || 'date') as 'date' | 'amount' | 'description';
    const sortOrder = (url.searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Parse and validate filters
    const filters: SearchFilters = {};
    if (query) filters.query = query;
    if (categoryIdsStr) filters.categoryIds = categoryIdsStr.split(',').filter(Boolean);
    if (accountIdsStr) filters.accountIds = accountIdsStr.split(',').filter(Boolean);
    if (tagIdsStr) filters.tagIds = tagIdsStr.split(',').filter(Boolean);
    if (customFieldIdsStr) filters.customFieldIds = customFieldIdsStr.split(',').filter(Boolean);
    if (typesStr) filters.types = typesStr.split(',').filter(Boolean);
    if (amountMin !== null && amountMin !== undefined) {
      const parsed = parseFloat(amountMin);
      if (!isNaN(parsed)) filters.amountMin = parsed;
    }
    if (amountMax !== null && amountMax !== undefined) {
      const parsed = parseFloat(amountMax);
      if (!isNaN(parsed)) filters.amountMax = parsed;
    }
    if (dateStart) filters.dateStart = dateStart;
    if (dateEnd) filters.dateEnd = dateEnd;
    if (isPending !== null && isPending !== undefined) filters.isPending = isPending === 'true';
    if (isSplit !== null && isSplit !== undefined) filters.isSplit = isSplit === 'true';
    if (hasNotes !== null && hasNotes !== undefined) filters.hasNotes = hasNotes === 'true';
    filters.sortBy = sortBy;
    filters.sortOrder = sortOrder;

    // Build dynamic WHERE conditions
    const conditions: any[] = [
      eq(transactions.userId, userId),
      eq(transactions.householdId, householdId)
    ];

    // Text search in description and notes
    if (filters.query) {
      const searchPattern = `%${filters.query}%`;
      conditions.push(
        or(
          like(transactions.description, searchPattern),
          like(transactions.notes, searchPattern)
        ) as any
      );
    }

    // Category filter - verify categories belong to household
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      // Verify all categories belong to household
      const categoriesInHousehold = await db.select({ id: budgetCategories.id })
        .from(budgetCategories)
        .where(and(
          eq(budgetCategories.householdId, householdId),
          inArray(budgetCategories.id, filters.categoryIds)
        ));

      const validCategoryIds = categoriesInHousehold.map(c => c.id);
      if (validCategoryIds.length > 0) {
        conditions.push(inArray(transactions.categoryId, validCategoryIds));
      } else {
        // No valid categories found in household - return empty result
        return Response.json({
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
        });
      }
    }

    // Account filter - verify accounts belong to household
    if (filters.accountIds && filters.accountIds.length > 0) {
      // Verify all accounts belong to household
      const accountsInHousehold = await db.select({ id: accounts.id })
        .from(accounts)
        .where(and(
          eq(accounts.householdId, householdId),
          inArray(accounts.id, filters.accountIds)
        ));

      const validAccountIds = accountsInHousehold.map(a => a.id);
      if (validAccountIds.length > 0) {
        conditions.push(inArray(transactions.accountId, validAccountIds));
      } else {
        // No valid accounts found in household - return empty result
        return Response.json({
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
        });
      }
    }

    // Type filter
    if (filters.types && filters.types.length > 0) {
      conditions.push(inArray(transactions.type, filters.types as any));
    }

    // Amount range filter
    if (filters.amountMin !== undefined) {
      conditions.push(gte(transactions.amount, filters.amountMin));
    }
    if (filters.amountMax !== undefined) {
      conditions.push(lte(transactions.amount, filters.amountMax));
    }

    // Date range filter
    if (filters.dateStart) {
      conditions.push(gte(transactions.date, filters.dateStart));
    }
    if (filters.dateEnd) {
      conditions.push(lte(transactions.date, filters.dateEnd));
    }

    // Pending filter
    if (filters.isPending !== undefined) {
      conditions.push(eq(transactions.isPending, filters.isPending));
    }

    // Split transaction filter
    if (filters.isSplit !== undefined) {
      conditions.push(eq(transactions.isSplit, filters.isSplit));
    }

    // Has notes filter
    if (filters.hasNotes !== undefined) {
      if (filters.hasNotes) {
        conditions.push(sql`${transactions.notes} IS NOT NULL AND ${transactions.notes} != ''`);
      } else {
        conditions.push(sql`${transactions.notes} IS NULL OR ${transactions.notes} = ''`);
      }
    }

    // Handle tag filtering - if tags are specified, we need a different approach with joins
    let query_builder: any = db
      .select()
      .from(transactions);

    if (filters.tagIds && filters.tagIds.length > 0) {
      // For tag filtering, use inner join and group by transaction
      query_builder = db
        .selectDistinct()
        .from(transactions)
        .innerJoin(transactionTags, eq(transactions.id, transactionTags.transactionId))
        .where(and(...conditions, inArray(transactionTags.tagId, filters.tagIds)));
    } else {
      query_builder = query_builder.where(and(...conditions));
    }

    // Add sorting
    if (filters.sortBy === 'amount') {
      query_builder = query_builder.orderBy(
        filters.sortOrder === 'asc'
          ? transactions.amount
          : sql`${transactions.amount} DESC`
      ) as any;
    } else if (filters.sortBy === 'description') {
      query_builder = query_builder.orderBy(
        filters.sortOrder === 'asc'
          ? transactions.description
          : sql`${transactions.description} DESC`
      ) as any;
    } else {
      // Default: date sorting
      query_builder = query_builder.orderBy(
        filters.sortOrder === 'asc'
          ? transactions.date
          : sql`${transactions.date} DESC`
      ) as any;
    }

    // Get total count first (without limit/offset)
    let countQuery: any = db
      .select({ count: sql<number>`COUNT(DISTINCT ${transactions.id})` })
      .from(transactions);

    if (filters.tagIds && filters.tagIds.length > 0) {
      countQuery = countQuery
        .innerJoin(transactionTags, eq(transactions.id, transactionTags.transactionId))
        .where(and(...conditions, inArray(transactionTags.tagId, filters.tagIds)));
    } else {
      countQuery = countQuery.where(and(...conditions));
    }

    const countResult = await countQuery;
    const totalCount = countResult[0]?.count || 0;

    // Get paginated results
    let results: any;
    if (filters.tagIds && filters.tagIds.length > 0) {
      const joinResults = await query_builder
        .limit(limit)
        .offset(offset);
      // Extract just the transaction data from the join
      results = joinResults.map((row: any) => row.transactions);
    } else {
      results = await query_builder
        .limit(limit)
        .offset(offset);
    }

    const executionTime = performance.now() - startTime;

    // Track search in history (async, don't wait for it)
    try {
      await db.insert(searchHistory).values({
        id: nanoid(),
        userId,
        filters: JSON.stringify(filters),
        resultCount: totalCount,
        executionTimeMs: Math.round(executionTime),
        executedAt: new Date().toISOString(),
      });
    } catch (error) {
      // Log but don't fail the search if history tracking fails
      console.error('Error tracking search history:', error);
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
        executionTimeMs: Math.round(executionTime),
        filtersApplied: Object.keys(filters).length > 0,
        appliedFilters: filters,
      },
    });
    } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Transaction search error:', error);
    return Response.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
    }
}
