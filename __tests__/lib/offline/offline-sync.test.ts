/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/offline/transaction-queue', () => ({
  offlineTransactionQueue: {
    markAsSyncing: vi.fn(),
    markAsSynced: vi.fn(),
    markSyncError: vi.fn(),
    getPendingTransactions: vi.fn(),
    getAllTransactions: vi.fn(),
    updateTransactionStatus: vi.fn(),
    deleteTransaction: vi.fn(),
  },
}));

import { offlineTransactionQueue } from '@/lib/offline/transaction-queue';

describe('lib/offline/offline-sync', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it('syncPendingTransactions returns empty summary when no pending', async () => {
    (offlineTransactionQueue.getPendingTransactions as any).mockResolvedValueOnce([]);

    const { syncPendingTransactions } = await import('@/lib/offline/offline-sync');
    const res = await syncPendingTransactions('u1');

    expect(res).toEqual({
      totalPending: 0,
      successCount: 0,
      errorCount: 0,
      results: [],
    });
  });

  it('syncPendingTransactions syncs sequentially and records success', async () => {
    (offlineTransactionQueue.getPendingTransactions as any).mockResolvedValueOnce([
      { id: 'off1', userId: 'u1', formData: { a: 1 }, attempts: 0, syncStatus: 'pending' },
      { id: 'off2', userId: 'u1', formData: { b: 2 }, attempts: 0, syncStatus: 'pending' },
    ]);

    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tx1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tx2' }) });

    const { syncPendingTransactions } = await import('@/lib/offline/offline-sync');
    const promise = syncPendingTransactions('u1');
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(offlineTransactionQueue.markAsSyncing).toHaveBeenCalledWith('off1');
    expect(offlineTransactionQueue.markAsSynced).toHaveBeenCalledWith('off1', 'tx1');
    expect(offlineTransactionQueue.markAsSyncing).toHaveBeenCalledWith('off2');
    expect(offlineTransactionQueue.markAsSynced).toHaveBeenCalledWith('off2', 'tx2');

    expect(res.totalPending).toBe(2);
    expect(res.successCount).toBe(2);
    expect(res.errorCount).toBe(0);
    expect(res.results.map((r) => r.transactionId)).toEqual(['tx1', 'tx2']);
  });

  it('syncPendingTransactions marks sync error when server responds not ok', async () => {
    (offlineTransactionQueue.getPendingTransactions as any).mockResolvedValueOnce([
      { id: 'off1', userId: 'u1', formData: { a: 1 }, attempts: 0, syncStatus: 'pending' },
    ]);

    (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Boom' });

    const { syncPendingTransactions } = await import('@/lib/offline/offline-sync');
    const promise = syncPendingTransactions('u1');
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(offlineTransactionQueue.markAsSyncing).toHaveBeenCalledWith('off1');
    expect(offlineTransactionQueue.markSyncError).toHaveBeenCalledWith(
      'off1',
      expect.stringContaining('Server error: 500'),
      1
    );
    expect(res.successCount).toBe(0);
    expect(res.errorCount).toBe(1);
    expect(res.results[0].success).toBe(false);
  });

  it('syncPendingTransactions skips transactions that exceeded max attempts', async () => {
    (offlineTransactionQueue.getPendingTransactions as any).mockResolvedValueOnce([
      { id: 'off1', userId: 'u1', formData: { a: 1 }, attempts: 3, syncStatus: 'pending' },
      { id: 'off2', userId: 'u1', formData: { b: 2 }, attempts: 0, syncStatus: 'pending' },
    ]);

    (global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tx2' }) });

    const { syncPendingTransactions } = await import('@/lib/offline/offline-sync');
    const promise = syncPendingTransactions('u1');
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(offlineTransactionQueue.markAsSynced).toHaveBeenCalledWith('off2', 'tx2');
    expect(res.totalPending).toBe(2);
    expect(res.successCount).toBe(1);
  });

  it('autoSync returns safe empty summary when sync throws', async () => {
    const { autoSync } = await import('@/lib/offline/offline-sync');
    // Force syncPendingTransactions to throw by mocking getPendingTransactions to throw during call
    (offlineTransactionQueue.getPendingTransactions as any).mockRejectedValueOnce(new Error('boom'));

    const res = await autoSync('u1');
    expect(res).toEqual({
      totalPending: 0,
      successCount: 0,
      errorCount: 0,
      results: [],
    });
  });

  it('getSyncStatus counts statuses correctly', async () => {
    (offlineTransactionQueue.getAllTransactions as any).mockResolvedValueOnce([
      { syncStatus: 'pending' },
      { syncStatus: 'pending' },
      { syncStatus: 'syncing' },
      { syncStatus: 'synced' },
      { syncStatus: 'error' },
    ]);

    const { getSyncStatus } = await import('@/lib/offline/offline-sync');
    const res = await getSyncStatus('u1');
    expect(res).toEqual({ pending: 2, syncing: 1, synced: 1, errors: 1 });
  });

  it('retrySyncErrors resets errored transactions to pending and retries', async () => {
    (offlineTransactionQueue.getAllTransactions as any).mockResolvedValueOnce([
      { id: 'off1', userId: 'u1', formData: { a: 1 }, attempts: 1, syncStatus: 'error' },
    ]);

    (global.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tx1' }) });

    const { retrySyncErrors } = await import('@/lib/offline/offline-sync');
    const promise = retrySyncErrors('u1');
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(offlineTransactionQueue.updateTransactionStatus).toHaveBeenCalledWith(
      'off1',
      'pending',
      expect.objectContaining({ attempts: 0 })
    );
    expect(offlineTransactionQueue.markAsSynced).toHaveBeenCalledWith('off1', 'tx1');
    expect(res.successCount).toBe(1);
  });

  it('discardOfflineTransaction deletes from queue', async () => {
    const { discardOfflineTransaction } = await import('@/lib/offline/offline-sync');
    await discardOfflineTransaction('off1');
    expect(offlineTransactionQueue.deleteTransaction).toHaveBeenCalledWith('off1');
  });
});


