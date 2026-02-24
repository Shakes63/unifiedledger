/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/calendar-sync/sync/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/calendar/sync-service', () => ({
  fullSync: vi.fn(),
  isSyncEnabled: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { fullSync, isSyncEnabled } from '@/lib/calendar/sync-service';

function createRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

describe('POST /api/calendar-sync/sync', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (getAndVerifyHousehold as any).mockResolvedValue({ householdId: 'hh-1', membership: { role: 'owner' } });
    (isSyncEnabled as any).mockResolvedValue(true);
    (fullSync as any).mockResolvedValue({
      success: true,
      synced: 0,
      skipped: 0,
      errors: [],
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    const res = await POST(createRequest({}));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 when sync is not enabled', async () => {
    (isSyncEnabled as any).mockResolvedValue(false);
    const res = await POST(createRequest({}));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('No active calendar connections');
  });

  it('returns 207 when sync completes with errors', async () => {
    (fullSync as any).mockResolvedValue({
      success: false,
      synced: 5,
      skipped: 1,
      errors: [{ sourceType: 'bill_instance', sourceId: 'x', error: 'boom' }],
    });

    const res = await POST(createRequest({}));
    const data = await res.json();

    expect(res.status).toBe(207);
    expect(data.message).toBe('Sync completed with errors');
    expect(data.success).toBe(false);
    expect(data.errors.length).toBe(1);
  });

  it('returns 200 when sync succeeds', async () => {
    (fullSync as any).mockResolvedValue({
      success: true,
      synced: 2,
      skipped: 0,
      errors: [],
    });

    const res = await POST(createRequest({}));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe('Calendar sync completed successfully');
    expect(data.success).toBe(true);
    expect(data.synced).toBe(2);
  });

  it('returns 500 on unexpected errors', async () => {
    (fullSync as any).mockRejectedValue(new Error('unexpected'));
    const res = await POST(createRequest({}));
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to sync calendar');
  });
});


