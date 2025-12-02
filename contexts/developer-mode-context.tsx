'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';

const STORAGE_KEY = 'unifiedledger-developer-mode';

interface DeveloperModeContextType {
  isDeveloperMode: boolean;
  loading: boolean;
  toggleDeveloperMode: () => Promise<void>;
}

const DeveloperModeContext = createContext<DeveloperModeContextType | undefined>(undefined);

export function DeveloperModeProvider({ children }: { children: ReactNode }) {
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load from server and update localStorage cache
  const loadDeveloperModeFromServer = useCallback(async () => {
    try {
      const response = await fetch('/api/user/settings', { credentials: 'include' });

      if (response.ok) {
        const data = await response.json();
        const serverValue = data.developerMode || false;
        setIsDeveloperMode(serverValue);
        // Update localStorage to match server (source of truth)
        localStorage.setItem(STORAGE_KEY, String(serverValue));
      }
    } catch (error) {
      console.error('Failed to load developer mode setting:', error);
      // Keep cached value on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Load from localStorage first (instant), then sync with server
  useEffect(() => {
    // Read from localStorage immediately after mount for instant persistence
    const cachedValue = localStorage.getItem(STORAGE_KEY);
    if (cachedValue !== null) {
      setIsDeveloperMode(cachedValue === 'true');
    }

    // Then fetch from server to ensure we're in sync
    loadDeveloperModeFromServer();
  }, [loadDeveloperModeFromServer]);

  const toggleDeveloperMode = async () => {
    const newValue = !isDeveloperMode;

    // Optimistically update UI and localStorage
    setIsDeveloperMode(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));

    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      // Revert on error (both state and localStorage)
      setIsDeveloperMode(!newValue);
      localStorage.setItem(STORAGE_KEY, String(!newValue));
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
