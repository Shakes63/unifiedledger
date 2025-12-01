'use client';

/**
 * Business Features Context
 *
 * Provides app-wide state for business feature visibility.
 * Business features (Tax Dashboard, Sales Tax) are hidden unless
 * at least one active business account exists in the current household.
 *
 * Usage:
 * ```typescript
 * const { hasBusinessAccounts, isLoading, refresh } = useBusinessFeatures();
 *
 * // Conditionally render business features
 * {hasBusinessAccounts && <TaxDashboardLink />}
 * ```
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useHousehold } from './household-context';

interface BusinessFeaturesContextValue {
  /**
   * Whether the current household has at least one active business account
   */
  hasBusinessAccounts: boolean;

  /**
   * Whether the business accounts check is in progress
   */
  isLoading: boolean;

  /**
   * Force refresh the business accounts check.
   * Call this after creating, updating, or deleting accounts.
   */
  refresh: () => Promise<void>;
}

const BusinessFeaturesContext = createContext<BusinessFeaturesContextValue | undefined>(undefined);

export function BusinessFeaturesProvider({ children }: { children: ReactNode }) {
  const { selectedHouseholdId, initialized } = useHousehold();
  const [hasBusinessAccounts, setHasBusinessAccounts] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Don't fetch if household context isn't ready yet
    if (!initialized || !selectedHouseholdId) {
      setHasBusinessAccounts(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/accounts/has-business', {
        credentials: 'include',
        headers: {
          'x-household-id': selectedHouseholdId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHasBusinessAccounts(data.hasBusinessAccounts ?? false);
      } else {
        // If error, default to false (hide business features)
        console.error('[BusinessFeatures] Failed to check business accounts:', response.status);
        setHasBusinessAccounts(false);
      }
    } catch (error) {
      console.error('[BusinessFeatures] Error checking business accounts:', error);
      setHasBusinessAccounts(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedHouseholdId, initialized]);

  // Refresh when household changes or becomes initialized
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <BusinessFeaturesContext.Provider value={{ hasBusinessAccounts, isLoading, refresh }}>
      {children}
    </BusinessFeaturesContext.Provider>
  );
}

export function useBusinessFeatures() {
  const context = useContext(BusinessFeaturesContext);
  if (context === undefined) {
    throw new Error('useBusinessFeatures must be used within BusinessFeaturesProvider');
  }
  return context;
}

