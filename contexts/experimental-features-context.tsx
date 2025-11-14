'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ExperimentalFeaturesContextType {
  enabled: boolean;
  loading: boolean;
}

const ExperimentalFeaturesContext = createContext<ExperimentalFeaturesContextType>({
  enabled: false,
  loading: true,
});

export function ExperimentalFeaturesProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/user/settings', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setEnabled(data.experimentalFeatures || false);
        }
      } catch (error) {
        console.error('Failed to load experimental features setting:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  return (
    <ExperimentalFeaturesContext.Provider value={{ enabled, loading }}>
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
