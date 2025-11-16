/**
 * Request Queue Manager
 *
 * Manages failed HTTP requests that occurred while offline or due to network errors.
 * Queues requests for automatic retry when connection is restored.
 * Extends existing offline infrastructure using IndexedDB.
 */

export type RequestPriority = 'critical' | 'normal' | 'low';

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body?: string | null;
  headers?: Record<string, string>;
  priority: RequestPriority;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  userId?: string;
  lastError?: string;
}

export interface RequestQueueState {
  pending: QueuedRequest[];
  processing: QueuedRequest[];
  failed: QueuedRequest[];
}

const DB_NAME = 'unified-ledger-offline';
const DB_VERSION = 2; // Increment to add new store
const STORE_NAME = 'failedRequests';

// Priority order for processing
const PRIORITY_ORDER: Record<RequestPriority, number> = {
  critical: 0,
  normal: 1,
  low: 2,
};

class RequestQueue {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private processingQueue = false;
  private maxConcurrent = 3;
  private activeRequests = 0;

  /**
   * Initialize IndexedDB connection
   */
  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB for request queue:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Request queue IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

          // Create indexes for efficient querying
          store.createIndex('priority', 'priority', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('retryCount', 'retryCount', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('status', 'status', { unique: false });

          console.log('Request queue IndexedDB store created with indexes');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Generate unique ID for request
   */
  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Queue a failed request
   */
  async queue(
    request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>,
    maxRetries: number = 3
  ): Promise<string> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    const queuedRequest: QueuedRequest = {
      ...request,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const addRequest = store.add(queuedRequest);

      addRequest.onerror = () => {
        console.error('Failed to queue request:', addRequest.error);
        reject(addRequest.error);
      };

      addRequest.onsuccess = () => {
        console.log(`Request queued: ${queuedRequest.id} (${queuedRequest.priority})`);
        resolve(queuedRequest.id);
      };
    });
  }

  /**
   * Get all pending requests, sorted by priority
   */
  async getPendingRequests(userId?: string): Promise<QueuedRequest[]> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        let requests = (request.result as QueuedRequest[]) || [];

        // Filter by user if provided
        if (userId) {
          requests = requests.filter((r) => r.userId === userId || !r.userId);
        }

        // Filter out requests that exceeded max retries
        requests = requests.filter((r) => r.retryCount < r.maxRetries);

        // Sort by priority and timestamp
        requests.sort((a, b) => {
          const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a.timestamp - b.timestamp;
        });

        resolve(requests);
      };
    });
  }

  /**
   * Process a single queued request
   */
  private async processRequest(request: QueuedRequest): Promise<boolean> {
    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: request.headers || {},
        credentials: 'include',
      };

      if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
        fetchOptions.body = request.body;
      }

      const response = await fetch(request.url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Success - remove from queue
      await this.remove(request.id);
      console.log(`Successfully processed queued request: ${request.id}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const newRetryCount = request.retryCount + 1;

      if (newRetryCount >= request.maxRetries) {
        // Max retries exceeded - move to failed list
        await this.updateRequest(request.id, {
          retryCount: newRetryCount,
          lastError: errorMessage,
        });
        console.warn(`Request ${request.id} exceeded max retries: ${errorMessage}`);
        return false;
      }

      // Update retry count
      await this.updateRequest(request.id, {
        retryCount: newRetryCount,
        lastError: errorMessage,
      });

      console.log(`Request ${request.id} failed (attempt ${newRetryCount}/${request.maxRetries}): ${errorMessage}`);
      return false;
    }
  }

  /**
   * Process all pending requests in the queue
   */
  async processQueue(userId?: string): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (this.processingQueue) {
      console.log('Queue processing already in progress');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.processingQueue = true;

    try {
      const pending = await this.getPendingRequests(userId);

      if (pending.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      console.log(`Processing ${pending.length} queued requests`);

      let succeeded = 0;
      let failed = 0;

      // Process requests with concurrency limit
      const processBatch = async (batch: QueuedRequest[]) => {
        const results = await Promise.allSettled(
          batch.map((req) => this.processRequest(req))
        );

        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            succeeded++;
          } else {
            failed++;
          }
        });
      };

      // Process in batches respecting concurrency limit
      for (let i = 0; i < pending.length; i += this.maxConcurrent) {
        const batch = pending.slice(i, i + this.maxConcurrent);
        await processBatch(batch);

        // Small delay between batches
        if (i + this.maxConcurrent < pending.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return {
        processed: pending.length,
        succeeded,
        failed,
      };
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Update a queued request
   */
  private async updateRequest(id: string, updates: Partial<QueuedRequest>): Promise<void> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onerror = () => {
        reject(getRequest.error);
      };

      getRequest.onsuccess = () => {
        const request = getRequest.result as QueuedRequest;

        if (!request) {
          reject(new Error(`Request ${id} not found`));
          return;
        }

        const updated = { ...request, ...updates };
        const updateRequest = store.put(updated);

        updateRequest.onerror = () => {
          reject(updateRequest.error);
        };

        updateRequest.onsuccess = () => {
          resolve();
        };
      };
    });
  }

  /**
   * Remove a request from the queue
   */
  async remove(id: string): Promise<void> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Get queue state
   */
  async getState(userId?: string): Promise<RequestQueueState> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        let requests = (request.result as QueuedRequest[]) || [];

        // Filter by user if provided
        if (userId) {
          requests = requests.filter((r) => r.userId === userId || !r.userId);
        }

        const pending = requests.filter((r) => r.retryCount < r.maxRetries);
        const failed = requests.filter((r) => r.retryCount >= r.maxRetries);

        resolve({
          pending,
          processing: [], // Not tracked separately for now
          failed,
        });
      };
    });
  }

  /**
   * Get count of pending requests
   */
  async getPendingCount(userId?: string): Promise<number> {
    const pending = await this.getPendingRequests(userId);
    return pending.length;
  }

  /**
   * Clear all queued requests
   */
  async clear(userId?: string): Promise<void> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    if (userId) {
      // Clear only user's requests
      const state = await this.getState(userId);
      const allIds = [...state.pending, ...state.processing, ...state.failed].map((r) => r.id);
      
      await Promise.all(allIds.map((id) => this.remove(id)));
    } else {
      // Clear all requests
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => {
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    }
  }
}

// Export singleton instance
export const requestQueue = new RequestQueue();

