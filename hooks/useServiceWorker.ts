import { useEffect, useState, useCallback } from 'react';
import {
  isServiceWorkerSupported,
  registerServiceWorker,
  unregisterServiceWorker,
  getCacheStatus,
  clearAllCaches,
  clearCache,
  getCacheSize,
  getStorageQuota,
  isStorageLow,
  cleanupCache,
  skipWaiting,
  onBackgroundSync,
  CacheStatus,
} from '@/lib/service-worker/cache-manager';

export interface UseServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  registration: ServiceWorkerRegistration | null;
  cacheStatus: CacheStatus | null;
  cacheSize: number;
  storageQuota: number;
  isStorageLow: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for managing service worker and caching
 */
export function useServiceWorker(autoRegister = true) {
  const [state, setState] = useState<UseServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    registration: null,
    cacheStatus: null,
    cacheSize: 0,
    storageQuota: 0,
    isStorageLow: false,
    isLoading: true,
    error: null,
  });

  // Initialize service worker support detection
  useEffect(() => {
    const supported = isServiceWorkerSupported();
    setState(prev => ({ ...prev, isSupported: supported }));

    if (supported && autoRegister) {
      registerServiceWorker().then(registration => {
        setState(prev => ({
          ...prev,
          isRegistered: !!registration,
          registration,
          isLoading: false,
        }));
      }).catch(error => {
        setState(prev => ({
          ...prev,
          error,
          isLoading: false,
        }));
      });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [autoRegister]);

  // Update cache status periodically
  useEffect(() => {
    if (!state.isRegistered) return;

    const updateCacheStatus = async () => {
      try {
        const cacheStatus = await getCacheStatus();
        const cacheSize = await getCacheSize();
        const quota = await getStorageQuota();
        const storageLow = await isStorageLow();

        setState(prev => ({
          ...prev,
          cacheStatus,
          cacheSize,
          storageQuota: quota,
          isStorageLow: storageLow,
        }));
      } catch (error) {
        console.error('Failed to update cache status:', error);
      }
    };

    updateCacheStatus();

    // Update every 30 seconds
    const interval = setInterval(updateCacheStatus, 30000);

    return () => clearInterval(interval);
  }, [state.isRegistered]);

  // Setup background sync listener
  useEffect(() => {
    if (!state.isRegistered) return;

    const unsubscribe = onBackgroundSync(() => {
      console.log('Background sync triggered - transactions ready to sync');
      // Trigger any sync handlers or callbacks here
    });

    return unsubscribe;
  }, [state.isRegistered]);

  // Unregister handler
  const handleUnregister = useCallback(async () => {
    try {
      const success = await unregisterServiceWorker();
      if (success) {
        setState(prev => ({
          ...prev,
          isRegistered: false,
          registration: null,
          cacheStatus: null,
        }));
      }
      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      return false;
    }
  }, []);

  // Clear all caches handler
  const handleClearAllCaches = useCallback(async () => {
    try {
      const success = await clearAllCaches();
      if (success) {
        setState(prev => ({
          ...prev,
          cacheSize: 0,
        }));
      }
      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      return false;
    }
  }, []);

  // Clear specific cache handler
  const handleClearCache = useCallback(async (cacheName: string) => {
    try {
      return await clearCache(cacheName);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      return false;
    }
  }, []);

  // Cleanup cache handler
  const handleCleanup = useCallback(async () => {
    try {
      await cleanupCache();
      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      return false;
    }
  }, []);

  // Skip waiting handler
  const handleSkipWaiting = useCallback(() => {
    skipWaiting();
  }, []);

  return {
    ...state,
    unregister: handleUnregister,
    clearAllCaches: handleClearAllCaches,
    clearCache: handleClearCache,
    cleanup: handleCleanup,
    skipWaiting: handleSkipWaiting,
  };
}
