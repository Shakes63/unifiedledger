'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { offlineTransactionQueue } from '@/lib/offline/transaction-queue';
import { syncPendingTransactions, getSyncStatus, SyncSummary } from '@/lib/offline/offline-sync';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Sync Status Component
 * Shows pending transactions and sync progress
 */
export function SyncStatus() {
  const { userId } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [syncStatus, setSyncStatus] = useState({
    pending: 0,
    syncing: 0,
    synced: 0,
    errors: 0,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Get initial sync status
  useEffect(() => {
    if (!userId) return;

    const loadStatus = async () => {
      try {
        const status = await getSyncStatus(userId);
        setSyncStatus(status);
      } catch (error) {
        console.error('Failed to load sync status:', error);
      }
    };

    loadStatus();
  }, [userId]);

  // Trigger sync when coming online
  const handleAutoSync = useCallback(async () => {
    if (!userId || !isOnline) return;

    console.log('Auto-syncing pending transactions');
    await performSync();
  }, [userId, isOnline]);

  // Manual sync trigger
  const performSync = useCallback(async () => {
    if (!userId || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await syncPendingTransactions(userId);
      setSyncResult(result);
      setLastSyncTime(new Date());

      // Update status
      const status = await getSyncStatus(userId);
      setSyncStatus(status);

      // Show toast notification
      if (result.successCount > 0) {
        console.log(`✅ Synced ${result.successCount} transaction(s)`);
      }
      if (result.errorCount > 0) {
        console.log(`⚠️ ${result.errorCount} transaction(s) failed to sync`);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [userId, isSyncing]);

  // Don't show if no pending transactions and online
  if (syncStatus.pending === 0 && isOnline) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm">
      {/* Status Icon */}
      {syncStatus.errors > 0 ? (
        <AlertCircle className="w-4 h-4 text-[#f87171]" />
      ) : syncStatus.pending > 0 || syncStatus.syncing > 0 ? (
        <RefreshCw className="w-4 h-4 text-[#60a5fa] animate-spin" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
      )}

      {/* Status Text */}
      <div className="flex-1">
        {syncStatus.errors > 0 ? (
          <span className="text-[#f87171]">
            {syncStatus.errors} error{syncStatus.errors > 1 ? 's' : ''}
          </span>
        ) : syncStatus.pending > 0 || syncStatus.syncing > 0 ? (
          <span className="text-[#60a5fa]">
            {syncStatus.pending + syncStatus.syncing} pending
          </span>
        ) : (
          <span className="text-[#10b981]">All synced</span>
        )}
      </div>

      {/* Sync Button */}
      {(syncStatus.pending > 0 || syncStatus.syncing > 0 || syncStatus.errors > 0) && (
        <button
          onClick={performSync}
          disabled={isSyncing || !isOnline}
          className="p-1 hover:bg-[#2a2a2a] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={!isOnline ? 'Go online to sync' : 'Sync now'}
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
      )}

      {/* Last Sync Time */}
      {lastSyncTime && (
        <div className="text-xs text-[#6b7280]">
          {Math.round((Date.now() - lastSyncTime.getTime()) / 1000)}s ago
        </div>
      )}
    </div>
  );
}

/**
 * Pending Transactions Drawer
 * Shows list of pending/synced transactions
 */
export function PendingTransactionsList() {
  const { userId } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!userId || !isOpen) return;

    const loadTransactions = async () => {
      try {
        const all = await offlineTransactionQueue.getAllTransactions(userId);
        // Sort by timestamp descending
        all.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(all);
      } catch (error) {
        console.error('Failed to load transactions:', error);
      }
    };

    loadTransactions();
  }, [userId, isOpen]);

  if (transactions.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-[#2a2a2a] pt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm text-[#60a5fa] hover:underline"
      >
        {isOpen ? 'Hide' : 'Show'} offline transactions ({transactions.length})
      </button>

      {isOpen && (
        <div className="mt-4 space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-sm">
              <div className="flex items-center gap-2">
                {tx.syncStatus === 'synced' && (
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                )}
                {tx.syncStatus === 'pending' && (
                  <RefreshCw className="w-4 h-4 text-[#60a5fa]" />
                )}
                {tx.syncStatus === 'error' && (
                  <AlertCircle className="w-4 h-4 text-[#f87171]" />
                )}

                <div className="flex-1">
                  <div className="text-[#ffffff]">
                    {tx.formData.description || 'Unnamed transaction'}
                  </div>
                  <div className="text-xs text-[#6b7280]">
                    {new Date(tx.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-[#ffffff]">
                    ${Math.abs(tx.formData.amount || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-[#9ca3af] capitalize">{tx.syncStatus}</div>
                </div>
              </div>

              {tx.lastError && (
                <div className="mt-2 text-xs text-[#f87171] bg-[#2a1a1a] p-2 rounded">
                  Error: {tx.lastError}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
