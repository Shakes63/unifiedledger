'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { applyTheme } from '@/lib/themes/theme-utils';
import { enhancedFetch, FetchError, FetchErrorType } from '@/lib/utils/enhanced-fetch';
import { toast } from 'sonner';

interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  joinedAt: string;
  isFavorite: boolean;
}

interface UserHouseholdPreferences {
  theme: string;
  dateFormat: string;
  numberFormat: string;
  defaultAccountId: string | null;
  firstDayOfWeek: string;
  showCents: boolean;
  negativeNumberFormat: string;
  defaultTransactionType: string;
  // Notification preferences
  billRemindersEnabled: boolean;
  billRemindersChannels: string;
  budgetWarningsEnabled: boolean;
  budgetWarningsChannels: string;
  budgetExceededEnabled: boolean;
  budgetExceededChannels: string;
  budgetReviewEnabled: boolean;
  budgetReviewChannels: string;
  lowBalanceEnabled: boolean;
  lowBalanceChannels: string;
  savingsMilestonesEnabled: boolean;
  savingsMilestonesChannels: string;
  debtMilestonesEnabled: boolean;
  debtMilestonesChannels: string;
  weeklySummariesEnabled: boolean;
  weeklySummariesChannels: string;
  monthlySummariesEnabled: boolean;
  monthlySummariesChannels: string;
  // High utilization notifications (Phase 10)
  highUtilizationEnabled: boolean;
  highUtilizationThreshold: number;
  highUtilizationChannels: string;
  // Credit limit change notifications (Phase 10)
  creditLimitChangeEnabled: boolean;
  creditLimitChangeChannels: string;
  // Income late notifications (Phase 16)
  incomeLateEnabled: boolean;
  incomeLateChannels: string;
}

interface HouseholdContextType {
  households: Household[];
  selectedHouseholdId: string | null;
  selectedHousehold: Household | null;
  preferences: UserHouseholdPreferences | null;
  loading: boolean;
  preferencesLoading: boolean;
  initialized: boolean;
  error: Error | null;
  setSelectedHouseholdId: (id: string) => Promise<void>;
  refreshHouseholds: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
  retry: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdIdState] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserHouseholdPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Computed value for selected household
  const selectedHousehold = selectedHouseholdId
    ? households.find((h) => h.id === selectedHouseholdId) || null
    : null;

  // Load user preferences for a household
  const loadPreferences = async (householdId: string) => {
    try {
      setPreferencesLoading(true);

      const response = await enhancedFetch(
        `/api/user/households/${householdId}/preferences`,
        {
          credentials: 'include',
          deduplicate: false, // Prevent "body stream already read" in Strict Mode
          retries: 2,
          timeout: 8000,
          onRetry: (attempt) => {
            console.log(`Retrying preferences load (attempt ${attempt})...`);
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPreferences(data);

        // Apply theme immediately
        if (data.theme) {
          applyTheme(data.theme);
          // Also save to localStorage for instant loading next time
          try {
            localStorage.setItem('unified-ledger:theme', data.theme);
          } catch {
            // Ignore storage errors
          }
        }
      } else {
        // Handle non-ok response
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to load household preferences:', error);

      // Show user-friendly error message
      if (error instanceof FetchError) {
        if (error.type === FetchErrorType.NETWORK) {
          toast.error('Unable to load preferences', {
            description: 'Please check your internet connection',
          });
        } else if (error.type === FetchErrorType.TIMEOUT) {
          toast.error('Request timed out', {
            description: 'Please try again',
          });
        } else if (error.statusCode === 401) {
          // Don't show toast for auth errors, let middleware handle redirect
          console.warn('Unauthorized - redirecting to sign in');
        } else {
          toast.error('Failed to load preferences', {
            description: 'Using cached settings',
          });
        }
      }

      // Try to load cached preferences from localStorage
      try {
        const cachedTheme = localStorage.getItem('unified-ledger:theme');
        if (cachedTheme) {
          applyTheme(cachedTheme);
        }
      } catch {
        // Ignore storage errors
      }
    } finally {
      setPreferencesLoading(false);
    }
  };

  // Refresh preferences for current household
  const refreshPreferences = async () => {
    if (selectedHouseholdId) {
      await loadPreferences(selectedHouseholdId);
    }
  };

  // Set selected household with preference loading
  const setSelectedHouseholdId = async (id: string) => {
    setSelectedHouseholdIdState(id);

    // Persist to localStorage
    try {
      localStorage.setItem('unified-ledger:selected-household', id);
    } catch {
      // Ignore storage errors
    }

    // Load preferences for new household
    await loadPreferences(id);
  };

  const refreshHouseholds = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await enhancedFetch('/api/households', {
        credentials: 'include',
        deduplicate: false, // Prevent "body stream already read" in Strict Mode
        retries: 3,
        timeout: 10000,
        onRetry: (attempt) => {
          console.log(`Retrying households load (attempt ${attempt})...`);
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHouseholds(data);
        setInitialized(true);
        setError(null);

        // Try to restore last selected household from localStorage
        let initialHouseholdId: string | null = null;
        try {
          initialHouseholdId = localStorage.getItem('unified-ledger:selected-household');
        } catch {
          // Ignore storage errors
        }

        // If no household is selected or the selected one no longer exists, select appropriately
        if (!selectedHouseholdId || !data.find((h: Household) => h.id === selectedHouseholdId)) {
          if (data.length > 0) {
            // Try to use persisted household if it exists
            const householdToSelect = initialHouseholdId && data.find((h: Household) => h.id === initialHouseholdId)
              ? initialHouseholdId
              : data[0].id;

            setSelectedHouseholdIdState(householdToSelect);
            await loadPreferences(householdToSelect);
          } else {
            setSelectedHouseholdIdState(null);
            setPreferences(null);
          }
        } else {
          // Load preferences for currently selected household
          await loadPreferences(selectedHouseholdId);
        }
      } else {
        // Handle non-ok response
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch households:', error);

      // Set error state
      const err = error instanceof Error ? error : new Error('Failed to load households');
      setError(err);
      setInitialized(false);

      // Show user-friendly error message
      if (error instanceof FetchError) {
        if (error.type === FetchErrorType.NETWORK) {
          toast.error('Unable to load households', {
            description: 'Please check your internet connection',
            action: {
              label: 'Retry',
              onClick: () => refreshHouseholds(),
            },
          });
        } else if (error.type === FetchErrorType.TIMEOUT) {
          toast.error('Request timed out', {
            description: 'Loading households took too long',
            action: {
              label: 'Retry',
              onClick: () => refreshHouseholds(),
            },
          });
        } else if (error.statusCode === 401) {
          // Don't show toast for auth errors, let middleware handle redirect
          console.warn('Unauthorized - redirecting to sign in');
        } else {
          toast.error('Failed to load households', {
            description: error.getUserMessage(),
            action: {
              label: 'Retry',
              onClick: () => refreshHouseholds(),
            },
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Retry function for manual retries
  const retry = async () => {
    await refreshHouseholds();
  };

  useEffect(() => {
    refreshHouseholds();
    // Intentionally run only on mount - refreshHouseholds is stable and including it would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HouseholdContext.Provider
      value={{
        households,
        selectedHouseholdId,
        selectedHousehold,
        preferences,
        loading,
        preferencesLoading,
        initialized,
        error,
        setSelectedHouseholdId,
        refreshHouseholds,
        refreshPreferences,
        retry,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
}
