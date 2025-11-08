'use client';

import { useAuth } from '@clerk/nextjs';
import { useOnlineStatus } from './useOnlineStatus';
import { offlineTransactionQueue, OfflineTransaction } from '@/lib/offline/transaction-queue';
import { nanoid } from 'nanoid';

/**
 * Hook for handling offline transaction creation
 * Returns functions for submitting transactions that work offline
 */
export function useOfflineTransaction() {
  const { userId } = useAuth();
  const { isOnline } = useOnlineStatus();

  /**
   * Submit a transaction, queuing it offline if necessary
   */
  const submitTransaction = async (formData: Record<string, any>) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (isOnline) {
      // Submit directly to server
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create transaction: ${response.statusText}`);
      }

      return response.json();
    } else {
      // Queue for offline sync
      const offlineId = nanoid();
      const transaction: OfflineTransaction = {
        id: offlineId,
        userId,
        formData,
        timestamp: Date.now(),
        syncStatus: 'pending',
        attempts: 0,
        createdAt: new Date().toISOString(),
      };

      await offlineTransactionQueue.addTransaction(transaction);

      return {
        id: offlineId,
        offline: true,
        message: 'Transaction saved offline. Will sync when online.',
      };
    }
  };

  /**
   * Check if currently offline
   */
  const checkOfflineStatus = (): { isOffline: boolean; message?: string } => {
    if (!isOnline) {
      return {
        isOffline: true,
        message: 'You are offline. Transactions will be saved locally and synced when online.',
      };
    }

    return { isOffline: false };
  };

  /**
   * Get pending offline transactions count
   */
  const getPendingCount = async (): Promise<number> => {
    if (!userId) return 0;
    return offlineTransactionQueue.getPendingCount(userId);
  };

  return {
    submitTransaction,
    checkOfflineStatus,
    getPendingCount,
    isOnline,
  };
}
