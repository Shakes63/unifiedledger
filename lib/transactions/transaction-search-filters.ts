export const TRANSACTION_TYPES = ['income', 'expense', 'transfer_in', 'transfer_out'] as const;

type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface SearchFilters {
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

export interface ParsedSearchRequest {
  filters: SearchFilters;
  limit: number;
  offset: number;
}

export interface TransactionSearchResponsePayload {
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

export function isTransactionType(value: string): value is TransactionType {
  return (TRANSACTION_TYPES as readonly string[]).includes(value);
}
