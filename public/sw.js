/**
 * Advanced Service Worker with intelligent caching strategies
 * Implements cache-first, stale-while-revalidate, and network-first strategies
 */

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  STATIC: `static-${CACHE_VERSION}`,
  DYNAMIC: `dynamic-${CACHE_VERSION}`,
  API: `api-${CACHE_VERSION}`,
  IMAGES: `images-${CACHE_VERSION}`,
};

const CACHE_URLS = {
  // Static assets that rarely change - cache first
  STATIC: [
    '/',
    '/dashboard',
    /\.js$/,
    /\.css$/,
    /\.woff2?$/,
    /\.ttf$/,
    /\.eot$/,
  ],
  // Images - cache first with fallback
  IMAGES: [
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.webp$/,
    /\.svg$/,
  ],
  // API calls - stale-while-revalidate
  API: [/^\/api\//],
  // HTML pages - network first with cache fallback
  HTML: [/\.html$/],
};

/**
 * Determine which caching strategy to use based on URL
 */
function getCacheStrategy(url) {
  const urlObj = new URL(url);

  // API endpoints - stale-while-revalidate
  if (CACHE_URLS.API.some(pattern => pattern.test(urlObj.pathname))) {
    return 'stale-while-revalidate';
  }

  // Images - cache first
  if (CACHE_URLS.IMAGES.some(pattern => pattern.test(urlObj.pathname))) {
    return 'cache-first';
  }

  // Static assets - cache first
  if (CACHE_URLS.STATIC.some(pattern => pattern.test(urlObj.pathname))) {
    return 'cache-first';
  }

  // HTML pages and everything else - network first
  return 'network-first';
}

/**
 * Cache-first strategy: try cache first, fallback to network
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAMES.STATIC);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    // Only cache successful responses
    if (response.ok && response.status === 200) {
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
    }

    return response;
  } catch (error) {
    console.error('Fetch failed:', error);
    return new Response('Offline - resource not available', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Network-first strategy: try network first, fallback to cache
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAMES.DYNAMIC);

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok && response.status === 200) {
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
    }

    return response;
  } catch (error) {
    console.error('Network request failed:', error);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    // Check if this is an HTML request
    const url = new URL(request.url);
    if (request.headers.get('accept')?.includes('text/html') || url.pathname === '/' || url.pathname.endsWith('.html')) {
      // Return offline.html for HTML page requests
      try {
        const offlineCache = await caches.open(CACHE_NAMES.STATIC);
        const offlineResponse = await offlineCache.match('/offline.html');
        if (offlineResponse) {
          return offlineResponse;
        }
      } catch (offlineError) {
        console.error('Could not load offline.html:', offlineError);
      }
    }

    // Return offline page or error response
    return new Response('Offline - please check your connection', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Stale-while-revalidate strategy: return cache immediately, update in background
 */
async function staleWhileRevalidate(request) {
  const cacheName = CACHE_NAMES.API;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Return cached response immediately while fetching in background
  const fetchPromise = fetch(request).then(response => {
    // Only cache successful responses
    if (response.ok && response.status === 200) {
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
    }
    return response;
  });

  return cached || fetchPromise;
}

/**
 * Handle fetch events with appropriate caching strategy
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests and non-GET methods
  if (url.origin !== location.origin || request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other special protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  const strategy = getCacheStrategy(request.url);

  if (strategy === 'cache-first') {
    event.respondWith(cacheFirst(request));
  } else if (strategy === 'stale-while-revalidate') {
    event.respondWith(staleWhileRevalidate(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

/**
 * Handle install event - pre-cache essential assets
 */
self.addEventListener('install', event => {
  console.log('Service Worker installing...');

  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC).then(cache => {
      // Pre-cache essential assets
      return cache.addAll([
        '/',
        '/dashboard',
        '/offline.html', // Fallback page if needed
      ]).catch(err => {
        console.warn('Pre-cache failed:', err);
        // Don't fail install if some assets aren't available yet
      });
    })
  );

  // Skip waiting to activate immediately
  self.skipWaiting();
});

/**
 * Handle activate event - clean up old caches
 */
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete caches that aren't in our current CACHE_NAMES
          const isOldCache = !Object.values(CACHE_NAMES).includes(cacheName);
          if (isOldCache) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    })
  );

  // Claim all clients immediately
  self.clients.matchAll().then(clients => {
    clients.forEach(client => self.clients.claim());
  });
});

/**
 * Handle message events from clients
 */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Handle cache clear requests
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      ).then(() => {
        event.ports[0].postMessage({ success: true });
      });
    });
  }

  // Handle cache status requests
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    caches.keys().then(cacheNames => {
      const status = {
        caches: cacheNames,
        version: CACHE_VERSION,
      };
      event.ports[0].postMessage(status);
    });
  }
});

/**
 * Handle background sync for offline transactions
 * This allows offline transactions to sync when connection is restored
 */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(
      clients.matchAll().then(clientList => {
        clientList.forEach(client => {
          client.postMessage({
            type: 'SYNC_TRANSACTIONS',
            timestamp: new Date().toISOString(),
          });
        });
      })
    );
  }
});
