/**
 * Offline Transaction Queue Manager
 *
 * Manages pending transactions that were created while offline
 * Uses IndexedDB for reliable local storage with transaction support
 */

export interface OfflineTransaction {
  id: string; // Unique offline ID
  userId: string;
  formData: Record<string, unknown>; // Complete transaction form data
  timestamp: number; // When transaction was created (ms since epoch)
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error'; // Current sync state
  syncedId?: string; // Server transaction ID after sync
  attempts: number; // Number of sync attempts
  lastError?: string; // Last sync error message
  createdAt: string; // ISO string
}

const DB_NAME = 'unified-ledger-offline';
// NOTE: Shared DB with other offline stores (e.g., request queue). Keep version in sync across modules.
const DB_VERSION = 2;
const STORE_NAME = 'offlineTransactions';

class OfflineTransactionQueue {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB connection
   */
  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

          // Create indexes for efficient querying
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('userSyncStatus', ['userId', 'syncStatus'], { unique: false });

          console.log('IndexedDB store created with indexes');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Add a pending transaction to the queue
   */
  async addTransaction(transaction: OfflineTransaction): Promise<void> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction_obj = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction_obj.objectStore(STORE_NAME);
      const request = store.add(transaction);

      request.onerror = () => {
        console.error('Failed to add transaction to queue:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('Transaction added to offline queue:', transaction.id);
        resolve();
      };
    });
  }

  /**
   * Get all pending transactions for a user
   */
  async getPendingTransactions(userId: string): Promise<OfflineTransaction[]> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('userSyncStatus');
      const range = IDBKeyRange.bound([userId, 'pending'], [userId, 'pending\uffff']);
      const request = index.getAll(range);

      request.onerror = () => {
        console.error('Failed to get pending transactions:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve((request.result as OfflineTransaction[]) || []);
      };
    });
  }

  /**
   * Get a specific transaction by ID
   */
  async getTransaction(id: string): Promise<OfflineTransaction | undefined> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => {
        console.error('Failed to get transaction:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result as OfflineTransaction | undefined);
      };
    });
  }

  /**
   * Update transaction sync status
   */
  async updateTransactionStatus(
    id: string,
    status: OfflineTransaction['syncStatus'],
    updates?: Partial<OfflineTransaction>
  ): Promise<void> {
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
        const transaction_data = getRequest.result as OfflineTransaction;

        if (!transaction_data) {
          reject(new Error(`Transaction ${id} not found`));
          return;
        }

        const updated = {
          ...transaction_data,
          syncStatus: status,
          ...updates,
        };

        const updateRequest = store.put(updated);

        updateRequest.onerror = () => {
          reject(updateRequest.error);
        };

        updateRequest.onsuccess = () => {
          console.log(`Transaction ${id} status updated to ${status}`);
          resolve();
        };
      };
    });
  }

  /**
   * Record successful sync with server transaction ID
   */
  async markAsSynced(offlineId: string, syncedId: string): Promise<void> {
    await this.updateTransactionStatus(offlineId, 'synced', {
      syncedId,
      attempts: 0,
      lastError: undefined,
    });
  }

  /**
   * Record sync failure with error
   */
  async markSyncError(offlineId: string, error: string, attempts: number): Promise<void> {
    await this.updateTransactionStatus(offlineId, 'error', {
      lastError: error,
      attempts,
    });
  }

  /**
   * Mark transaction as syncing
   */
  async markAsSyncing(offlineId: string): Promise<void> {
    await this.updateTransactionStatus(offlineId, 'syncing');
  }

  /**
   * Delete transaction from queue (after successful sync or user deletion)
   */
  async deleteTransaction(id: string): Promise<void> {
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
        console.log(`Transaction ${id} deleted from queue`);
        resolve();
      };
    });
  }

  /**
   * Get all transactions for a user (including synced)
   */
  async getAllTransactions(userId: string): Promise<OfflineTransaction[]> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve((request.result as OfflineTransaction[]) || []);
      };
    });
  }

  /**
   * Count pending transactions for a user
   */
  async getPendingCount(userId: string): Promise<number> {
    const pending = await this.getPendingTransactions(userId);
    return pending.length;
  }

  /**
   * Clear all offline data (for testing or logout)
   */
  async clearAll(): Promise<void> {
    await this.initialize();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('All offline data cleared');
        resolve();
      };
    });
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Export singleton instance
export const offlineTransactionQueue = new OfflineTransactionQueue();
