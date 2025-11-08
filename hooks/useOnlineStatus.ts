'use client';

import { useEffect, useState, useCallback } from 'react';

export type OnlineStatus = 'online' | 'offline' | 'checking';

/**
 * Hook to track whether the user is online or offline
 * Triggers sync when going from offline to online
 */
export function useOnlineStatus(onOnline?: () => void): {
  status: OnlineStatus;
  isOnline: boolean;
  isOffline: boolean;
} {
  const [status, setStatus] = useState<OnlineStatus>('checking');

  // Check initial online status
  useEffect(() => {
    // Set initial status
    setStatus(navigator.onLine ? 'online' : 'offline');
  }, []);

  const handleOnline = useCallback(() => {
    console.log('Browser came online');
    setStatus('online');

    // Call the provided callback (typically to trigger sync)
    if (onOnline) {
      onOnline();
    }
  }, [onOnline]);

  const handleOffline = useCallback(() => {
    console.log('Browser went offline');
    setStatus('offline');
  }, []);

  useEffect(() => {
    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
  };
}
