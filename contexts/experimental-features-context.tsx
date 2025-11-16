'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ExperimentalFeaturesContextType {
  enabled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ExperimentalFeaturesContext = createContext<ExperimentalFeaturesContextType>({
  enabled: false,
  loading: true,
  refresh: async () => {},
});

export function ExperimentalFeaturesProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/user/settings', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        // API returns { settings: {...} }
        setEnabled(data.settings?.experimentalFeatures || false);
      }
    } catch (error) {
      console.error('Failed to load experimental features setting:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Listen for storage events to refresh when settings change in another tab
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'experimental-features-updated') {
        loadSettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <ExperimentalFeaturesContext.Provider value={{ enabled, loading, refresh: loadSettings }}>
      {children}
    </ExperimentalFeaturesContext.Provider>
  );
}

export function useExperimentalFeatures() {
  const context = useContext(ExperimentalFeaturesContext);
  if (context === undefined) {
    throw new Error('useExperimentalFeatures must be used within ExperimentalFeaturesProvider');
  }
  return context;
}
