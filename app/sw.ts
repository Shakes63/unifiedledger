/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, StaleWhileRevalidate, ExpirationPlugin } from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'v1';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Fonts - Cache First (1 year)
    {
      matcher: ({ url }) => 
        url.hostname === 'fonts.googleapis.com' || 
        url.hostname === 'fonts.gstatic.com',
      handler: new CacheFirst({
        cacheName: `fonts-${CACHE_VERSION}`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          }),
        ],
      }),
    },
    // API calls - Stale While Revalidate (5 minutes)
    // Only cache GET requests - POST/PUT/DELETE have bodies that can't be cached
    {
      matcher: ({ url, request }) => 
        url.pathname.startsWith('/api/') && request.method === 'GET',
      handler: new StaleWhileRevalidate({
        cacheName: `api-${CACHE_VERSION}`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 5, // 5 minutes
          }),
        ],
      }),
    },
    // Images - Cache First (30 days)
    {
      matcher: ({ url }) => 
        /\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(url.pathname),
      handler: new CacheFirst({
        cacheName: `images-${CACHE_VERSION}`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          }),
        ],
      }),
    },
    // Static assets (JS, CSS) - Cache First (7 days)
    {
      matcher: ({ url }) => 
        /\.(js|css|woff2?|ttf|eot)$/.test(url.pathname),
      handler: new CacheFirst({
        cacheName: `static-${CACHE_VERSION}`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          }),
        ],
      }),
    },
    // Default cache for everything else
    ...defaultCache,
  ],
});

// Add fetch listener BEFORE serwist to bypass it for non-GET requests
self.addEventListener('fetch', (event) => {
  // Let non-GET requests pass through without any service worker involvement
  if (event.request.method !== 'GET') {
    // Don't call event.respondWith - this lets the request proceed normally
    return;
  }
});

serwist.addEventListeners();

// Handle background sync for offline transactions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(
      self.clients.matchAll().then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'SYNC_TRANSACTIONS',
            timestamp: new Date().toISOString(),
          });
        });
      })
    );
  }
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Handle cache clear requests
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      ).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
    });
  }

  // Handle cache status requests
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    caches.keys().then((cacheNames) => {
      const status = {
        caches: cacheNames,
        version: CACHE_VERSION,
      };
      event.ports[0]?.postMessage(status);
    });
  }
});
