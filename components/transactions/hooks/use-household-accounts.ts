'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Account } from '@/lib/types';

type HouseholdFetch = (input: string, init?: RequestInit) => Promise<Response>;

interface UseHouseholdAccountsOptions {
  enabled: boolean;
  fetchWithHousehold: HouseholdFetch;
  emptySelectionMessage?: string;
}

interface UseHouseholdAccountsResult {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<Account[]>;
  clearError: () => void;
}

function mapAccountFetchErrorStatus(status: number) {
  if (status === 400) return 'Invalid household selection. Please try again.';
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 403) return "You don't have access to this household's accounts.";
  if (status === 500) return 'Server error. Please try again.';
  return 'Failed to load accounts';
}

export function useHouseholdAccounts({
  enabled,
  fetchWithHousehold,
  emptySelectionMessage = 'No household selected',
}: UseHouseholdAccountsOptions): UseHouseholdAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setAccounts([]);
      setLoading(false);
      setError(emptySelectionMessage);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithHousehold('/api/accounts');

      if (!response.ok) {
        const nextError = mapAccountFetchErrorStatus(response.status);
        setError(nextError);
        setAccounts([]);
        return [];
      }

      const data = (await response.json()) as Account[];
      setAccounts(data);
      return data;
    } catch (error) {
      const nextError = error instanceof Error ? error.message : 'Failed to fetch accounts';
      setError(nextError);
      setAccounts([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchWithHousehold, emptySelectionMessage]);

  useEffect(() => {
    if (!enabled) {
      setAccounts([]);
      setLoading(false);
      setError(null);
      return;
    }

    void refetch();
  }, [enabled, refetch]);

  return {
    accounts,
    loading,
    error,
    refetch,
    clearError: () => setError(null),
  };
}
