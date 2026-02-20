'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type {
  AccountListItem,
  CategoryListItem,
  MerchantListItem,
  TransactionListItem,
  TransactionSearchFilters,
} from '@/lib/types/transactions-ui';

type HouseholdFetch = (
  url: string,
  options?: RequestInit & { skipCache?: boolean }
) => Promise<Response>;

interface UseTransactionsDataArgs {
  initialized: boolean;
  householdLoading: boolean;
  householdId: string | null;
  selectedHouseholdId: string | null;
  accountIdFromUrl: string | null;
  fetchWithHousehold: HouseholdFetch;
}

const PAGE_SIZE = 50;

export function useTransactionsData({
  initialized,
  householdLoading,
  householdId,
  selectedHouseholdId,
  accountIdFromUrl,
  fetchWithHousehold,
}: UseTransactionsDataArgs) {
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [categories, setCategories] = useState<CategoryListItem[]>([]);
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [merchants, setMerchants] = useState<MerchantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [paginationOffset, setPaginationOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<TransactionSearchFilters | null>(null);
  const [combinedTransferView, setCombinedTransferView] = useState<boolean>(true);
  const [defaultImportTemplateId, setDefaultImportTemplateId] = useState<string | undefined>(undefined);

  const loadTransferPreference = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const prefsResponse = await fetchWithHousehold(
        `/api/user/households/${selectedHouseholdId}/preferences`
      );
      if (prefsResponse.ok) {
        const prefsData = await prefsResponse.json();
        setCombinedTransferView(prefsData.combinedTransferView !== false);
      }
    } catch (error) {
      console.error('Failed to fetch transfer view preference:', error);
    }
  }, [fetchWithHousehold, selectedHouseholdId]);

  const refreshTransactionsPage = useCallback(async (offset: number = 0, skipCache: boolean = true) => {
    const txResponse = await fetchWithHousehold(
      `/api/transactions?limit=${PAGE_SIZE}&offset=${offset}`,
      { skipCache }
    );

    if (!txResponse.ok) {
      throw new Error('Failed to refresh transactions');
    }

    const txData = await txResponse.json();
    const rows = txData.data || txData;
    const total = txData.total || txData.data?.length || txData.length || 0;

    setTransactions(rows);
    setTotalResults(total);
    setPaginationOffset(offset);
    setHasMore(offset + PAGE_SIZE < total);
  }, [fetchWithHousehold]);

  const performSearch = useCallback(async (
    filters: TransactionSearchFilters,
    offset: number = 0,
    skipCache: boolean = false
  ) => {
    try {
      setSearchLoading(true);

      const params = new URLSearchParams();
      if (filters.query) params.append('query', filters.query);
      if (filters.categoryIds?.length) params.append('categoryIds', filters.categoryIds.join(','));
      if (filters.accountIds?.length) params.append('accountIds', filters.accountIds.join(','));
      if (filters.types?.length) params.append('types', filters.types.join(','));
      if (filters.amountMin !== undefined) params.append('amountMin', filters.amountMin.toString());
      if (filters.amountMax !== undefined) params.append('amountMax', filters.amountMax.toString());
      if (filters.dateStart) params.append('dateStart', filters.dateStart);
      if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);
      if (filters.isPending) params.append('isPending', 'true');
      if (filters.isSplit) params.append('isSplit', 'true');
      if (filters.hasNotes) params.append('hasNotes', 'true');
      if (filters.hasSavingsGoal) params.append('hasSavingsGoal', 'true');
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      params.append('limit', PAGE_SIZE.toString());
      params.append('offset', offset.toString());

      const response = await fetchWithHousehold(
        `/api/transactions/search?${params.toString()}`,
        { skipCache }
      );
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
        setTotalResults(data.pagination.total);
        setHasMore(data.pagination.hasMore);
        setPaginationOffset(offset);

        if (offset === 0) {
          toast.success(`Found ${data.pagination.total} transaction(s)`);
        }
      } else {
        toast.error('Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search transactions');
    } finally {
      setSearchLoading(false);
    }
  }, [fetchWithHousehold]);

  const loadInitialData = useCallback(async () => {
    if (!initialized || householdLoading) return;

    if (!selectedHouseholdId || !householdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await refreshTransactionsPage(0, false);

      const [catResponse, accResponse, merResponse, settingsResponse] = await Promise.all([
        fetchWithHousehold('/api/categories'),
        fetchWithHousehold('/api/accounts'),
        fetchWithHousehold('/api/merchants?limit=1000'),
        fetch('/api/user/settings', { credentials: 'include' }),
      ]);

      if (catResponse.ok) {
        setCategories(await catResponse.json());
      }
      if (accResponse.ok) {
        setAccounts(await accResponse.json());
      }
      if (merResponse.ok) {
        setMerchants(await merResponse.json());
      }
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setDefaultImportTemplateId(settingsData.defaultImportTemplateId || undefined);
      }

      await loadTransferPreference();
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [
    fetchWithHousehold,
    householdId,
    householdLoading,
    initialized,
    loadTransferPreference,
    refreshTransactionsPage,
    selectedHouseholdId,
  ]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (accountIdFromUrl && accounts.length > 0) {
      const filters: TransactionSearchFilters = {
        accountIds: [accountIdFromUrl],
      };
      setCurrentFilters(filters);
      void performSearch(filters, 0);
    }
  }, [accountIdFromUrl, accounts, performSearch]);

  useEffect(() => {
    void loadTransferPreference();
  }, [loadTransferPreference]);

  const handleAdvancedSearch = useCallback(async (filters: TransactionSearchFilters) => {
    setCurrentFilters(filters);
    setPaginationOffset(0);
    await performSearch(filters, 0);
  }, [performSearch]);

  const handleClearFilters = useCallback(async () => {
    setCurrentFilters(null);
    setPaginationOffset(0);
    setHasMore(false);

    try {
      setSearchLoading(true);
      await refreshTransactionsPage(0, true);
    } catch (error) {
      console.error('Failed to refresh transactions:', error);
      toast.error('Failed to refresh transactions');
    } finally {
      setSearchLoading(false);
    }
  }, [refreshTransactionsPage]);

  const handleNextPage = useCallback(async () => {
    if (currentFilters) {
      await performSearch(currentFilters, paginationOffset + PAGE_SIZE);
      return;
    }

    try {
      setSearchLoading(true);
      await refreshTransactionsPage(paginationOffset + PAGE_SIZE, true);
    } catch (error) {
      console.error('Failed to fetch next page:', error);
      toast.error('Failed to load next page');
    } finally {
      setSearchLoading(false);
    }
  }, [currentFilters, paginationOffset, performSearch, refreshTransactionsPage]);

  const handlePreviousPage = useCallback(async () => {
    if (paginationOffset < PAGE_SIZE) {
      return;
    }

    if (currentFilters) {
      await performSearch(currentFilters, paginationOffset - PAGE_SIZE);
      return;
    }

    try {
      setSearchLoading(true);
      await refreshTransactionsPage(paginationOffset - PAGE_SIZE, true);
    } catch (error) {
      console.error('Failed to fetch previous page:', error);
      toast.error('Failed to load previous page');
    } finally {
      setSearchLoading(false);
    }
  }, [currentFilters, paginationOffset, performSearch, refreshTransactionsPage]);

  return {
    transactions,
    setTransactions,
    categories,
    setCategories,
    accounts,
    merchants,
    setMerchants,
    loading,
    searchLoading,
    totalResults,
    paginationOffset,
    pageSize: PAGE_SIZE,
    hasMore,
    currentFilters,
    combinedTransferView,
    defaultImportTemplateId,
    performSearch,
    refreshTransactionsPage,
    handleAdvancedSearch,
    handleClearFilters,
    handleNextPage,
    handlePreviousPage,
  };
}
