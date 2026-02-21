'use client';

import { createContext, useCallback, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { applyTheme, getCachedTheme } from '@/lib/themes/theme-utils';
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

interface HouseholdEntity {
  id: string;
  householdId: string;
  name: string;
  type: 'personal' | 'business';
  isDefault: boolean;
  enableSalesTax: boolean;
  isActive: boolean;
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
  entities: HouseholdEntity[];
  selectedEntityId: string | null;
  selectedEntity: HouseholdEntity | null;
  preferences: UserHouseholdPreferences | null;
  loading: boolean;
  preferencesLoading: boolean;
  entitiesLoading: boolean;
  initialized: boolean;
  error: Error | null;
  setSelectedHouseholdId: (id: string) => Promise<void>;
  setSelectedEntityId: (id: string) => Promise<void>;
  refreshHouseholds: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
  refreshEntities: () => Promise<void>;
  retry: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdIdState] = useState<string | null>(null);
  const [entities, setEntities] = useState<HouseholdEntity[]>([]);
  const [selectedEntityId, setSelectedEntityIdState] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserHouseholdPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const selectedHouseholdIdRef = useRef<string | null>(selectedHouseholdId);

  // Computed value for selected household
  const selectedHousehold = selectedHouseholdId
    ? households.find((h) => h.id === selectedHouseholdId) || null
    : null;
  const selectedEntity = selectedEntityId
    ? entities.find((entity) => entity.id === selectedEntityId) || null
    : null;

  const getEntityStorageKey = useCallback((householdId: string) => {
    return `unified-ledger:selected-entity:${householdId}`;
  }, []);

  // Load user preferences for a household
  const loadPreferences = useCallback(async (householdId: string) => {
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
          applyTheme(data.theme, { householdId });
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
        const cachedTheme = getCachedTheme(householdId);
        if (cachedTheme) {
          applyTheme(cachedTheme, { householdId, persist: false });
        }
      } catch {
        // Ignore storage errors
      }
    } finally {
      setPreferencesLoading(false);
    }
  }, []);

  const loadEntities = useCallback(async (householdId: string) => {
    try {
      setEntitiesLoading(true);
      const response = await enhancedFetch(`/api/households/${householdId}/entities`, {
        credentials: 'include',
        deduplicate: false,
        retries: 2,
        timeout: 8000,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const loadedEntities = (data.entities || []) as HouseholdEntity[];
      setEntities(loadedEntities);

      let persistedEntityId: string | null = null;
      try {
        persistedEntityId = localStorage.getItem(getEntityStorageKey(householdId));
      } catch {
        // Ignore storage errors
      }

      const selectedId =
        (persistedEntityId && loadedEntities.find((entity) => entity.id === persistedEntityId)?.id) ||
        loadedEntities.find((entity) => entity.isDefault)?.id ||
        loadedEntities[0]?.id ||
        null;

      setSelectedEntityIdState(selectedId);
      if (selectedId) {
        try {
          localStorage.setItem(getEntityStorageKey(householdId), selectedId);
        } catch {
          // Ignore storage errors
        }
      }
    } catch (error) {
      console.error('Failed to load household entities:', error);
      setEntities([]);
      setSelectedEntityIdState(null);
    } finally {
      setEntitiesLoading(false);
    }
  }, [getEntityStorageKey]);

  // Refresh preferences for current household
  const refreshPreferences = useCallback(async () => {
    if (selectedHouseholdId) {
      await loadPreferences(selectedHouseholdId);
    }
  }, [loadPreferences, selectedHouseholdId]);

  const refreshEntities = useCallback(async () => {
    if (selectedHouseholdId) {
      await loadEntities(selectedHouseholdId);
    }
  }, [loadEntities, selectedHouseholdId]);

  // Set selected household with preference loading
  const setSelectedHouseholdId = useCallback(async (id: string) => {
    setSelectedHouseholdIdState(id);

    // Persist to localStorage
    try {
      localStorage.setItem('unified-ledger:selected-household', id);
    } catch {
      // Ignore storage errors
    }

    // Load preferences and entities for new household
    await Promise.all([
      loadPreferences(id),
      loadEntities(id),
    ]);
  }, [loadEntities, loadPreferences]);

  const setSelectedEntityId = useCallback(async (id: string) => {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    const exists = entities.find((entity) => entity.id === id);
    if (!exists) {
      throw new Error('Entity not found in selected household');
    }

    setSelectedEntityIdState(id);
    try {
      localStorage.setItem(getEntityStorageKey(selectedHouseholdId), id);
    } catch {
      // Ignore storage errors
    }
  }, [entities, getEntityStorageKey, selectedHouseholdId]);

  const refreshHouseholds = useCallback(async () => {
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
        const currentSelectedHouseholdId = selectedHouseholdIdRef.current;
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
        if (!currentSelectedHouseholdId || !data.find((h: Household) => h.id === currentSelectedHouseholdId)) {
          if (data.length > 0) {
            // Try to use persisted household if it exists
            const householdToSelect = initialHouseholdId && data.find((h: Household) => h.id === initialHouseholdId)
              ? initialHouseholdId
              : data[0].id;

            setSelectedHouseholdIdState(householdToSelect);
            await Promise.all([
              loadPreferences(householdToSelect),
              loadEntities(householdToSelect),
            ]);
          } else {
            setSelectedHouseholdIdState(null);
            setSelectedEntityIdState(null);
            setEntities([]);
            setPreferences(null);
          }
        } else {
          // Load preferences for currently selected household
          await Promise.all([
            loadPreferences(currentSelectedHouseholdId),
            loadEntities(currentSelectedHouseholdId),
          ]);
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
              onClick: () => { void refreshHouseholds(); },
            },
          });
        } else if (error.type === FetchErrorType.TIMEOUT) {
          toast.error('Request timed out', {
            description: 'Loading households took too long',
            action: {
              label: 'Retry',
              onClick: () => { void refreshHouseholds(); },
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
              onClick: () => { void refreshHouseholds(); },
            },
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [loadEntities, loadPreferences]);

  useEffect(() => {
    selectedHouseholdIdRef.current = selectedHouseholdId;
  }, [selectedHouseholdId]);

  // Retry function for manual retries
  const retry = useCallback(async () => {
    await refreshHouseholds();
  }, [refreshHouseholds]);

  useEffect(() => {
    void refreshHouseholds();
  }, [refreshHouseholds]);

  return (
    <HouseholdContext.Provider
      value={{
        households,
        selectedHouseholdId,
        selectedHousehold,
        entities,
        selectedEntityId,
        selectedEntity,
        preferences,
        loading,
        preferencesLoading,
        entitiesLoading,
        initialized,
        error,
        setSelectedHouseholdId,
        setSelectedEntityId,
        refreshHouseholds,
        refreshPreferences,
        refreshEntities,
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
