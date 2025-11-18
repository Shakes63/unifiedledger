'use client';

import { useState, useEffect, useCallback } from 'react';
import { useHousehold } from '@/contexts/household-context';

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
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (period === 'year') {
    // Current year
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31);
  } else {
    // Default: last 12 months
    endDate = new Date();
    startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
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

/**
 * Hook for managing report filters with localStorage persistence per household
 */
export function useReportFilters(): UseReportFiltersReturn {
  const { selectedHouseholdId } = useHousehold();
  
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [period, setPeriodState] = useState<Period>('12months');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedMerchantIds, setSelectedMerchantIds] = useState<string[]>([]);

  // Load filters from localStorage on mount or household change
  useEffect(() => {
    if (!selectedHouseholdId) {
      // Reset to defaults when no household selected
      setStartDate(DEFAULT_FILTERS.startDate);
      setEndDate(DEFAULT_FILTERS.endDate);
      setPeriodState(DEFAULT_FILTERS.period);
      setSelectedAccountIds(DEFAULT_FILTERS.accountIds);
      setSelectedCategoryIds(DEFAULT_FILTERS.categoryIds);
      setSelectedMerchantIds(DEFAULT_FILTERS.merchantIds);
      return;
    }

    const storageKey = `report-filters-${selectedHouseholdId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: StoredFilters = JSON.parse(stored);
        setStartDate(parsed.startDate ?? DEFAULT_FILTERS.startDate);
        setEndDate(parsed.endDate ?? DEFAULT_FILTERS.endDate);
        setPeriodState(parsed.period ?? DEFAULT_FILTERS.period);
        setSelectedAccountIds(parsed.accountIds ?? DEFAULT_FILTERS.accountIds);
        setSelectedCategoryIds(parsed.categoryIds ?? DEFAULT_FILTERS.categoryIds);
        setSelectedMerchantIds(parsed.merchantIds ?? DEFAULT_FILTERS.merchantIds);
      } else {
        // Initialize with defaults
        setStartDate(DEFAULT_FILTERS.startDate);
        setEndDate(DEFAULT_FILTERS.endDate);
        setPeriodState(DEFAULT_FILTERS.period);
        setSelectedAccountIds(DEFAULT_FILTERS.accountIds);
        setSelectedCategoryIds(DEFAULT_FILTERS.categoryIds);
        setSelectedMerchantIds(DEFAULT_FILTERS.merchantIds);
      }
    } catch (error) {
      console.error('Error loading report filters from localStorage:', error);
      // Fall back to defaults on error
      setStartDate(DEFAULT_FILTERS.startDate);
      setEndDate(DEFAULT_FILTERS.endDate);
      setPeriodState(DEFAULT_FILTERS.period);
      setSelectedAccountIds(DEFAULT_FILTERS.accountIds);
      setSelectedCategoryIds(DEFAULT_FILTERS.categoryIds);
      setSelectedMerchantIds(DEFAULT_FILTERS.merchantIds);
    }
  }, [selectedHouseholdId]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (!selectedHouseholdId) return;

    const storageKey = `report-filters-${selectedHouseholdId}`;
    try {
      const filtersToStore: StoredFilters = {
        startDate,
        endDate,
        period,
        accountIds: selectedAccountIds,
        categoryIds: selectedCategoryIds,
        merchantIds: selectedMerchantIds,
      };
      localStorage.setItem(storageKey, JSON.stringify(filtersToStore));
    } catch (error) {
      console.error('Error saving report filters to localStorage:', error);
    }
  }, [
    selectedHouseholdId,
    startDate,
    endDate,
    period,
    selectedAccountIds,
    selectedCategoryIds,
    selectedMerchantIds,
  ]);

  // Set date range (clears period)
  const setDateRange = useCallback((start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
    // Clear period when custom dates are set
    if (start && end) {
      setPeriodState(null);
    }
  }, []);

  // Set period (calculates and sets date range, clears custom dates)
  const setPeriod = useCallback((newPeriod: Period) => {
    setPeriodState(newPeriod);
    if (newPeriod) {
      // Calculate date range from period
      const { startDate: calculatedStart, endDate: calculatedEnd } = calculateDateRange(newPeriod);
      setStartDate(calculatedStart);
      setEndDate(calculatedEnd);
    } else {
      // Clear dates when period is cleared
      setStartDate(null);
      setEndDate(null);
    }
  }, []);

  // Set account IDs
  const setAccountIds = useCallback((ids: string[]) => {
    setSelectedAccountIds(ids);
  }, []);

  // Set category IDs
  const setCategoryIds = useCallback((ids: string[]) => {
    setSelectedCategoryIds(ids);
  }, []);

  // Set merchant IDs
  const setMerchantIds = useCallback((ids: string[]) => {
    setSelectedMerchantIds(ids);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return (
      (startDate !== null && endDate !== null) ||
      selectedAccountIds.length > 0 ||
      selectedCategoryIds.length > 0 ||
      selectedMerchantIds.length > 0
    );
  }, [startDate, endDate, selectedAccountIds, selectedCategoryIds, selectedMerchantIds]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setStartDate(DEFAULT_FILTERS.startDate);
    setEndDate(DEFAULT_FILTERS.endDate);
    setPeriodState(DEFAULT_FILTERS.period);
    setSelectedAccountIds(DEFAULT_FILTERS.accountIds);
    setSelectedCategoryIds(DEFAULT_FILTERS.categoryIds);
    setSelectedMerchantIds(DEFAULT_FILTERS.merchantIds);
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
    hasActiveFilters: hasActiveFilters(),
    clearAllFilters,
    getFilterParams,
  };
}

