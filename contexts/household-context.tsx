'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  joinedAt: string;
  isFavorite: boolean;
}

interface HouseholdContextType {
  households: Household[];
  selectedHouseholdId: string | null;
  loading: boolean;
  setSelectedHouseholdId: (id: string) => void;
  refreshHouseholds: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshHouseholds = async () => {
    try {
      const response = await fetch('/api/households');
      if (response.ok) {
        const data = await response.json();
        setHouseholds(data);

        // If no household is selected or the selected one no longer exists, select the first one
        if (!selectedHouseholdId || !data.find((h: Household) => h.id === selectedHouseholdId)) {
          if (data.length > 0) {
            setSelectedHouseholdId(data[0].id);
          } else {
            setSelectedHouseholdId(null);
          }
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
        loading,
        setSelectedHouseholdId,
        refreshHouseholds,
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
