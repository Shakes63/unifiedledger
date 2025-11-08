/**
 * Service Worker Cache Manager
 * Provides utilities to interact with the service worker and manage caches
 */

export interface CacheStatus {
  caches: string[];
  version: string;
}

/**
 * Check if service workers are supported in the browser
 */
export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    console.warn('Service Workers are not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // Always fetch the latest service worker
    });

    console.log('Service Worker registered successfully:', registration);

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker is ready, notify user
          console.log('New service worker ready to activate');
          showUpdateNotification();
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      return await registration.unregister();
    }
    return false;
  } catch (error) {
    console.error('Failed to unregister service worker:', error);
    return false;
  }
}

/**
 * Get cache status from the service worker
 */
export async function getCacheStatus(): Promise<CacheStatus | null> {
  if (!navigator.serviceWorker.controller) {
    console.warn('No active service worker controller');
    return null;
  }

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      resolve(event.data as CacheStatus);
    };

    navigator.serviceWorker.controller?.postMessage(
      { type: 'GET_CACHE_STATUS' },
      [channel.port2]
    );

    // Timeout after 5 seconds
    setTimeout(() => {
      reject(new Error('Cache status request timed out'));
    }, 5000);
  });
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<boolean> {
  if (!navigator.serviceWorker.controller) {
    console.warn('No active service worker controller');
    // Fallback: try direct cache API
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      return true;
    } catch (error) {
      console.error('Failed to clear caches:', error);
      return false;
    }
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      resolve(event.data.success === true);
    };

    navigator.serviceWorker.controller?.postMessage(
      { type: 'CLEAR_CACHE' },
      [channel.port2]
    );

    // Timeout after 5 seconds
    setTimeout(() => {
      resolve(false);
    }, 5000);
  });
}

/**
 * Clear specific cache by name
 */
export async function clearCache(cacheName: string): Promise<boolean> {
  try {
    return await caches.delete(cacheName);
  } catch (error) {
    console.error(`Failed to clear cache ${cacheName}:`, error);
    return false;
  }
}

/**
 * Get size of all caches in storage
 */
export async function getCacheSize(): Promise<number> {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    return 0;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  } catch (error) {
    console.error('Failed to estimate cache size:', error);
    return 0;
  }
}

/**
 * Get available storage space
 */
export async function getStorageQuota(): Promise<number> {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    return 0;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return estimate.quota || 0;
  } catch (error) {
    console.error('Failed to get storage quota:', error);
    return 0;
  }
}

/**
 * Check if storage is low (>90% used)
 */
export async function isStorageLow(): Promise<boolean> {
  const used = await getCacheSize();
  const quota = await getStorageQuota();

  if (quota === 0) return false;
  return (used / quota) > 0.9;
}

/**
 * Cleanup old cache entries to save space
 */
export async function cleanupCache(): Promise<void> {
  try {
    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();

      // Remove old entries (keep only last 100 requests per cache)
      if (requests.length > 100) {
        const toDelete = requests.slice(0, requests.length - 100);
        await Promise.all(
          toDelete.map(request => cache.delete(request))
        );
      }
    }

    console.log('Cache cleanup completed');
  } catch (error) {
    console.error('Failed to cleanup cache:', error);
  }
}

/**
 * Skip waiting and activate new service worker
 */
export function skipWaiting(): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SKIP_WAITING',
    });
  }
}

/**
 * Listen for background sync events (for offline transactions)
 */
export function onBackgroundSync(callback: () => void): () => void {
  if (!isServiceWorkerSupported()) {
    return () => {};
  }

  const messageHandler = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_TRANSACTIONS') {
      callback();
    }
  };

  navigator.serviceWorker.addEventListener('message', messageHandler);

  // Return unsubscribe function
  return () => {
    navigator.serviceWorker.removeEventListener('message', messageHandler);
  };
}

/**
 * Show update notification to user
 */
function showUpdateNotification(): void {
  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification('App Update Available', {
      body: 'A new version of Unified Ledger is ready. Please refresh to update.',
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: 'app-update',
      requireInteraction: true,
    });
  }
}

/**
 * Request notification permission if needed
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    return await Notification.requestPermission();
  }

  return 'denied';
}

/**
 * Cache a single URL manually
 */
export async function cacheUrl(url: string, cacheName: string = 'dynamic-v1'): Promise<boolean> {
  try {
    const cache = await caches.open(cacheName);
    const response = await fetch(url);

    if (response.ok) {
      await cache.put(url, response);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Failed to cache ${url}:`, error);
    return false;
  }
}

/**
 * Pre-cache a list of URLs
 */
export async function preCacheUrls(urls: string[], cacheName: string = 'static-v1'): Promise<void> {
  try {
    const cache = await caches.open(cacheName);
    await Promise.all(
      urls.map(url => {
        return fetch(url)
          .then(response => {
            if (response.ok) {
              return cache.put(url, response);
            }
          })
          .catch(error => {
            console.warn(`Failed to pre-cache ${url}:`, error);
          });
      })
    );
    console.log(`Pre-cached ${urls.length} URLs`);
  } catch (error) {
    console.error('Failed to pre-cache URLs:', error);
  }
}
