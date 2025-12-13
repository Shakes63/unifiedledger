import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/better-auth-client', () => ({
  betterAuthClient: {
    useSession: vi.fn(),
  },
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}));

vi.mock('@/lib/offline/transaction-queue', () => ({
  offlineTransactionQueue: {
    addTransaction: vi.fn(),
    getPendingCount: vi.fn(),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(),
}));

import { betterAuthClient } from '@/lib/better-auth-client';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { offlineTransactionQueue } from '@/lib/offline/transaction-queue';
import { nanoid } from 'nanoid';

describe('hooks/useOfflineTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when user is not authenticated', async () => {
    vi.mocked(betterAuthClient.useSession).mockReturnValue({ data: null } as never);
    vi.mocked(useOnlineStatus).mockReturnValue({ isOnline: false } as never);

    const { useOfflineTransaction } = await import('@/hooks/useOfflineTransaction');
    const { result } = renderHook(() => useOfflineTransaction());

    await expect(
      result.current.submitTransaction({
        type: 'expense',
        amount: '1.00',
        description: 'Test',
        date: '2025-01-01',
        accountId: 'acc1',
      })
    ).rejects.toThrow('User not authenticated');
  });

  it('submits directly to server when online', async () => {
    vi.mocked(betterAuthClient.useSession).mockReturnValue({ data: { user: { id: 'u1' } } } as never);
    vi.mocked(useOnlineStatus).mockReturnValue({ isOnline: true } as never);

    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'tx1' }),
    } as never);

    const { useOfflineTransaction } = await import('@/hooks/useOfflineTransaction');
    const { result } = renderHook(() => useOfflineTransaction());

    let response: unknown;
    await act(async () => {
      response = await result.current.submitTransaction({
        type: 'expense',
        amount: '12.34',
        description: 'Coffee',
        date: '2025-01-01',
        accountId: 'acc1',
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/transactions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(response).toEqual({ id: 'tx1' });
  });

  it('queues transaction when offline', async () => {
    vi.mocked(betterAuthClient.useSession).mockReturnValue({ data: { user: { id: 'u1' } } } as never);
    vi.mocked(useOnlineStatus).mockReturnValue({ isOnline: false } as never);
    vi.mocked(nanoid).mockReturnValue('offline-1');
    vi.mocked(offlineTransactionQueue.addTransaction).mockResolvedValueOnce(undefined as never);

    const { useOfflineTransaction } = await import('@/hooks/useOfflineTransaction');
    const { result } = renderHook(() => useOfflineTransaction());

    let response: any;
    await act(async () => {
      response = await result.current.submitTransaction({
        type: 'expense',
        amount: '12.34',
        description: 'Coffee',
        date: '2025-01-01',
        accountId: 'acc1',
      });
    });

    expect(offlineTransactionQueue.addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'offline-1',
        userId: 'u1',
        syncStatus: 'pending',
        attempts: 0,
        formData: expect.objectContaining({ description: 'Coffee' }),
      })
    );
    expect(response).toEqual(
      expect.objectContaining({
        id: 'offline-1',
        offline: true,
      })
    );
  });

  it('getPendingCount returns 0 without session user', async () => {
    vi.mocked(betterAuthClient.useSession).mockReturnValue({ data: null } as never);
    vi.mocked(useOnlineStatus).mockReturnValue({ isOnline: true } as never);

    const { useOfflineTransaction } = await import('@/hooks/useOfflineTransaction');
    const { result } = renderHook(() => useOfflineTransaction());

    const count = await result.current.getPendingCount();
    expect(count).toBe(0);
  });

  it('getPendingCount delegates to offlineTransactionQueue for user', async () => {
    vi.mocked(betterAuthClient.useSession).mockReturnValue({ data: { user: { id: 'u1' } } } as never);
    vi.mocked(useOnlineStatus).mockReturnValue({ isOnline: true } as never);
    vi.mocked(offlineTransactionQueue.getPendingCount).mockResolvedValueOnce(3 as never);

    const { useOfflineTransaction } = await import('@/hooks/useOfflineTransaction');
    const { result } = renderHook(() => useOfflineTransaction());

    const count = await result.current.getPendingCount();
    expect(count).toBe(3);
    expect(offlineTransactionQueue.getPendingCount).toHaveBeenCalledWith('u1');
  });
});


