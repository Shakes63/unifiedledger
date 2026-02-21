'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Bill, BillInstance } from '@/lib/types';

type HouseholdFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface UnpaidBillWithInstance {
  bill: Bill;
  instance: BillInstance;
}

interface UseUnpaidBillsOptions {
  enabled: boolean;
  fetchWithHousehold: HouseholdFetch;
}

interface UseUnpaidBillsResult {
  unpaidBills: UnpaidBillWithInstance[];
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
}

export function useUnpaidBills({
  enabled,
  fetchWithHousehold,
}: UseUnpaidBillsOptions): UseUnpaidBillsResult {
  const [unpaidBills, setUnpaidBills] = useState<UnpaidBillWithInstance[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnpaidBills([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/bills-v2/instances?status=pending,overdue&limit=100');
      if (response.ok) {
        const data = await response.json();
        setUnpaidBills(data.data || []);
      } else {
        setUnpaidBills([]);
      }
    } catch {
      setUnpaidBills([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchWithHousehold]);

  useEffect(() => {
    if (!enabled) {
      setUnpaidBills([]);
      setLoading(false);
      return;
    }

    void refresh();
  }, [enabled, refresh]);

  return {
    unpaidBills,
    loading,
    refresh,
    clear: () => setUnpaidBills([]),
  };
}
