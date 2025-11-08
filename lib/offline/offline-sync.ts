/**
 * Offline Sync Manager
 *
 * Handles syncing offline transactions to the server
 * Manages retry logic, conflict resolution, and error handling
 */

import { offlineTransactionQueue, OfflineTransaction } from './transaction-queue';

export interface SyncResult {
  success: boolean;
  transactionId: string;
  offlineId: string;
  error?: string;
}

export interface SyncSummary {
  totalPending: number;
  successCount: number;
  errorCount: number;
  results: SyncResult[];
}

const MAX_SYNC_ATTEMPTS = 3;
const SYNC_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Sync a single pending transaction to the server
 */
async function syncTransaction(transaction: OfflineTransaction): Promise<SyncResult> {
  try {
    await offlineTransactionQueue.markAsSyncing(transaction.id);

    // Send to server
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transaction.formData),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const transactionId = result.id;

    // Mark as synced in local storage
    await offlineTransactionQueue.markAsSynced(transaction.id, transactionId);

    console.log(
      `Successfully synced offline transaction ${transaction.id} as ${transactionId}`
    );

    return {
      success: true,
      transactionId,
      offlineId: transaction.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const newAttempts = transaction.attempts + 1;

    // Record error
    await offlineTransactionQueue.markSyncError(transaction.id, errorMessage, newAttempts);

    console.error(`Failed to sync offline transaction ${transaction.id}: ${errorMessage}`);

    return {
      success: false,
      offlineId: transaction.id,
      transactionId: '',
      error: errorMessage,
    };
  }
}

/**
 * Sync all pending transactions for a user
 */
export async function syncPendingTransactions(userId: string): Promise<SyncSummary> {
  console.log(`Starting sync for user ${userId}`);

  const pending = await offlineTransactionQueue.getPendingTransactions(userId);

  if (pending.length === 0) {
    console.log('No pending transactions to sync');
    return {
      totalPending: 0,
      successCount: 0,
      errorCount: 0,
      results: [],
    };
  }

  console.log(`Found ${pending.length} pending transactions`);

  // Filter out transactions that have exceeded max attempts
  const toSync = pending.filter((t) => t.attempts < MAX_SYNC_ATTEMPTS);
  const exceeded = pending.filter((t) => t.attempts >= MAX_SYNC_ATTEMPTS);

  if (exceeded.length > 0) {
    console.warn(
      `${exceeded.length} transactions exceeded max sync attempts (will be kept for manual review)`
    );
  }

  // Sync transactions sequentially to avoid race conditions
  const results: SyncResult[] = [];
  for (const transaction of toSync) {
    const result = await syncTransaction(transaction);
    results.push(result);

    // Add a small delay between syncs to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  console.log(`Sync complete: ${successCount} succeeded, ${errorCount} failed`);

  return {
    totalPending: pending.length,
    successCount,
    errorCount,
    results,
  };
}

/**
 * Check for sync-eligible transactions and sync them
 * Used when app detects online status change
 */
export async function autoSync(userId: string): Promise<SyncSummary> {
  try {
    return await syncPendingTransactions(userId);
  } catch (error) {
    console.error('Auto sync failed:', error);
    return {
      totalPending: 0,
      successCount: 0,
      errorCount: 0,
      results: [],
    };
  }
}

/**
 * Get sync status for a user
 */
export async function getSyncStatus(userId: string): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  errors: number;
}> {
  const allTransactions = await offlineTransactionQueue.getAllTransactions(userId);

  return {
    pending: allTransactions.filter((t) => t.syncStatus === 'pending').length,
    syncing: allTransactions.filter((t) => t.syncStatus === 'syncing').length,
    synced: allTransactions.filter((t) => t.syncStatus === 'synced').length,
    errors: allTransactions.filter((t) => t.syncStatus === 'error').length,
  };
}

/**
 * Retry failed transactions
 */
export async function retrySyncErrors(userId: string): Promise<SyncSummary> {
  const allTransactions = await offlineTransactionQueue.getAllTransactions(userId);
  const errorTransactions = allTransactions.filter((t) => t.syncStatus === 'error');

  if (errorTransactions.length === 0) {
    return {
      totalPending: 0,
      successCount: 0,
      errorCount: 0,
      results: [],
    };
  }

  // Reset attempts on error transactions and try again
  const results: SyncResult[] = [];
  for (const transaction of errorTransactions) {
    if (transaction.attempts < MAX_SYNC_ATTEMPTS) {
      // Reset to pending to retry
      await offlineTransactionQueue.updateTransactionStatus(transaction.id, 'pending', {
        attempts: 0,
        lastError: undefined,
      });

      const result = await syncTransaction(transaction);
      results.push(result);

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  return {
    totalPending: errorTransactions.length,
    successCount,
    errorCount,
    results,
  };
}

/**
 * Discard a pending transaction (user action)
 */
export async function discardOfflineTransaction(offlineId: string): Promise<void> {
  await offlineTransactionQueue.deleteTransaction(offlineId);
  console.log(`Discarded offline transaction ${offlineId}`);
}
