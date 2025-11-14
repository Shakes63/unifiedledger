'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { applyTheme } from '@/lib/themes/theme-utils';

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
}

interface HouseholdContextType {
  households: Household[];
  selectedHouseholdId: string | null;
  selectedHousehold: Household | null;
  preferences: UserHouseholdPreferences | null;
  loading: boolean;
  preferencesLoading: boolean;
  setSelectedHouseholdId: (id: string) => Promise<void>;
  refreshHouseholds: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdIdState] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserHouseholdPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferencesLoading, setPreferencesLoading] = useState(false);

  // Computed value for selected household
  const selectedHousehold = selectedHouseholdId
    ? households.find((h) => h.id === selectedHouseholdId) || null
    : null;

  // Load user preferences for a household
  const loadPreferences = async (householdId: string) => {
    try {
      setPreferencesLoading(true);
      const response = await fetch(`/api/user/households/${householdId}/preferences`, { credentials: 'include' });
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
      }
    } catch (error) {
      console.error('Failed to load household preferences:', error);
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
      const response = await fetch('/api/households', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setHouseholds(data);

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
      }
    } catch (error) {
      console.error('Failed to fetch households:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshHouseholds();
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
        setSelectedHouseholdId,
        refreshHouseholds,
        refreshPreferences,
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
