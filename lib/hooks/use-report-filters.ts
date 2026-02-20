'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useHousehold } from '@/contexts/household-context';
import { getMonthRangeForDate, getYearRangeForDate, toLocalDateString } from '@/lib/utils/local-date';

type Period = 'month' | 'year' | '12months' | null;

/**
 * Calculate date range from period or custom dates
 * Returns startDate and endDate as ISO date strings
 * Client-safe version (no server dependencies)
 */
function calculateDateRange(
  period?: string | null,
  startDateParam?: string | null,
  endDateParam?: string | null
): { startDate: string; endDate: string } {
  // If custom dates provided, use them
  if (startDateParam && endDateParam) {
    return {
      startDate: startDateParam,
      endDate: endDateParam,
    };
  }

  // Otherwise, calculate from period
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (period === 'month') {
    // Current month
    const monthRange = getMonthRangeForDate(now);
    return monthRange;
  } else if (period === 'year') {
    // Current year
    const yearRange = getYearRangeForDate(now);
    return yearRange;
  } else {
    // Default: last 12 months
    endDate = new Date(now);
    startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
  }

  return {
    startDate: toLocalDateString(startDate),
    endDate: toLocalDateString(endDate),
  };
}

interface StoredFilters {
  startDate: string | null;
  endDate: string | null;
  period: Period;
  accountIds: string[];
  categoryIds: string[];
  merchantIds: string[];
}

interface UseReportFiltersReturn {
  // Date range
  startDate: string | null;
  endDate: string | null;
  period: Period;
  setDateRange: (start: string | null, end: string | null) => void;
  setPeriod: (period: Period) => void;
  
  // Filters
  selectedAccountIds: string[];
  selectedCategoryIds: string[];
  selectedMerchantIds: string[];
  setAccountIds: (ids: string[]) => void;
  setCategoryIds: (ids: string[]) => void;
  setMerchantIds: (ids: string[]) => void;
  
  // Helpers
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  getFilterParams: () => URLSearchParams;
}

const DEFAULT_FILTERS: StoredFilters = {
  startDate: null,
  endDate: null,
  period: '12months',
  accountIds: [],
  categoryIds: [],
  merchantIds: [],
};

// Helper to load filters from localStorage
function loadFiltersFromStorage(householdId: string | null): StoredFilters {
  if (!householdId || typeof window === 'undefined') {
    return { ...DEFAULT_FILTERS };
  }
  const storageKey = `report-filters-${householdId}`;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed: StoredFilters = JSON.parse(stored);
      return {
        startDate: parsed.startDate ?? DEFAULT_FILTERS.startDate,
        endDate: parsed.endDate ?? DEFAULT_FILTERS.endDate,
        period: parsed.period ?? DEFAULT_FILTERS.period,
        accountIds: parsed.accountIds ?? DEFAULT_FILTERS.accountIds,
        categoryIds: parsed.categoryIds ?? DEFAULT_FILTERS.categoryIds,
        merchantIds: parsed.merchantIds ?? DEFAULT_FILTERS.merchantIds,
      };
    }
  } catch {
    // Fall back to defaults on error
  }
  return { ...DEFAULT_FILTERS };
}

/**
 * Hook for managing report filters with localStorage persistence per household
 */
export function useReportFilters(): UseReportFiltersReturn {
  const { selectedHouseholdId } = useHousehold();
  const prevHouseholdId = useRef<string | null>(null);
  
  // Combined filters state to avoid multiple setState calls
  const [filters, setFilters] = useState<StoredFilters>(() => 
    loadFiltersFromStorage(selectedHouseholdId)
  );

  // Destructure for convenience
  const { startDate, endDate, period, accountIds: selectedAccountIds, categoryIds: selectedCategoryIds, merchantIds: selectedMerchantIds } = filters;

  // Load filters when household changes (defer state update to avoid sync setState)
  useEffect(() => {
    if (prevHouseholdId.current !== selectedHouseholdId) {
      prevHouseholdId.current = selectedHouseholdId;
      // Use requestAnimationFrame to defer the state update
      requestAnimationFrame(() => {
        setFilters(loadFiltersFromStorage(selectedHouseholdId));
      });
    }
  }, [selectedHouseholdId]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (!selectedHouseholdId) return;

    const storageKey = `report-filters-${selectedHouseholdId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving report filters to localStorage:', error);
    }
  }, [selectedHouseholdId, filters]);

  // Set date range (clears period)
  const setDateRange = useCallback((start: string | null, end: string | null) => {
    setFilters(prev => ({
      ...prev,
      startDate: start,
      endDate: end,
      // Clear period when custom dates are set
      period: (start && end) ? null : prev.period,
    }));
  }, []);

  // Set period (calculates and sets date range, clears custom dates)
  const setPeriod = useCallback((newPeriod: Period) => {
    if (newPeriod) {
      // Calculate date range from period
      const { startDate: calculatedStart, endDate: calculatedEnd } = calculateDateRange(newPeriod);
      setFilters(prev => ({
        ...prev,
        period: newPeriod,
        startDate: calculatedStart,
        endDate: calculatedEnd,
      }));
    } else {
      // Clear dates when period is cleared
      setFilters(prev => ({
        ...prev,
        period: null,
        startDate: null,
        endDate: null,
      }));
    }
  }, []);

  // Set account IDs
  const setAccountIds = useCallback((ids: string[]) => {
    setFilters(prev => ({ ...prev, accountIds: ids }));
  }, []);

  // Set category IDs
  const setCategoryIds = useCallback((ids: string[]) => {
    setFilters(prev => ({ ...prev, categoryIds: ids }));
  }, []);

  // Set merchant IDs
  const setMerchantIds = useCallback((ids: string[]) => {
    setFilters(prev => ({ ...prev, merchantIds: ids }));
  }, []);

  // Check if any filters are active
  const hasActiveFilters = 
    (startDate !== null && endDate !== null) ||
    selectedAccountIds.length > 0 ||
    selectedCategoryIds.length > 0 ||
    selectedMerchantIds.length > 0;

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  // Build URLSearchParams for API calls
  const getFilterParams = useCallback((): URLSearchParams => {
    const params = new URLSearchParams();

    // Add period or date range (period takes precedence if both exist)
    if (period && (!startDate || !endDate)) {
      params.append('period', period);
    } else if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }

    // Add filter parameters
    if (selectedAccountIds.length > 0) {
      params.append('accountIds', selectedAccountIds.join(','));
    }
    if (selectedCategoryIds.length > 0) {
      params.append('categoryIds', selectedCategoryIds.join(','));
    }
    if (selectedMerchantIds.length > 0) {
      params.append('merchantIds', selectedMerchantIds.join(','));
    }

    return params;
  }, [period, startDate, endDate, selectedAccountIds, selectedCategoryIds, selectedMerchantIds]);

  return {
    startDate,
    endDate,
    period,
    setDateRange,
    setPeriod,
    selectedAccountIds,
    selectedCategoryIds,
    selectedMerchantIds,
    setAccountIds,
    setCategoryIds,
    setMerchantIds,
    hasActiveFilters,
    clearAllFilters,
    getFilterParams,
  };
}
