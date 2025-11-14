'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

interface DeveloperModeContextType {
  isDeveloperMode: boolean;
  loading: boolean;
  toggleDeveloperMode: () => Promise<void>;
}

const DeveloperModeContext = createContext<DeveloperModeContextType | undefined>(undefined);

export function DeveloperModeProvider({ children }: { children: ReactNode }) {
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load developer mode setting on mount
  useEffect(() => {
    loadDeveloperMode();
  }, []);

  const loadDeveloperMode = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/settings', { credentials: 'include' });

      if (response.ok) {
        const data = await response.json();
        setIsDeveloperMode(data.developerMode || false);
      }
    } catch (error) {
      console.error('Failed to load developer mode setting:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDeveloperMode = async () => {
    const newValue = !isDeveloperMode;

    // Optimistically update UI
    setIsDeveloperMode(newValue);

    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developerMode: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update developer mode');
      }

      toast.success(
        newValue
          ? 'Developer mode enabled - IDs and debug info now visible'
          : 'Developer mode disabled'
      );
    } catch (error) {
      console.error('Error toggling developer mode:', error);
      // Revert on error
      setIsDeveloperMode(!newValue);
      toast.error('Failed to toggle developer mode');
    }
  };

  return (
    <DeveloperModeContext.Provider
      value={{
        isDeveloperMode,
        loading,
        toggleDeveloperMode,
      }}
    >
      {children}
    </DeveloperModeContext.Provider>
  );
}

export function useDeveloperMode() {
  const context = useContext(DeveloperModeContext);
  if (context === undefined) {
    throw new Error('useDeveloperMode must be used within a DeveloperModeProvider');
  }
  return context;
}
