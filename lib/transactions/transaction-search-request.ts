import type {
  ParsedSearchRequest,
  SearchFilters,
  TransactionSearchResponsePayload,
} from '@/lib/transactions/transaction-search-filters';

export function parseTransactionSearchRequest(request: Request): ParsedSearchRequest {
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

export function buildEmptySearchResponse(
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
