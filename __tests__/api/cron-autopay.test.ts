/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The route enumerates households with enabled autopay rules.
const { mockSelectDistinct } = vi.hoisted(() => ({ mockSelectDistinct: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: {
    selectDistinct: mockSelectDistinct,
  },
}));

vi.mock('@/lib/bills/service', () => ({
  runAutopay: vi.fn(),
  getScheduledAutopayPreview: vi.fn(),
}));

vi.mock('@/lib/notifications/autopay-notifications', () => ({
  getAutopayProcessingSummary: vi.fn(),
}));

import { getScheduledAutopayPreview, runAutopay } from '@/lib/bills/service';
import { getAutopayProcessingSummary } from '@/lib/notifications/autopay-notifications';

describe('app/api/cron/autopay/route', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    // Route module captures CRON_SECRET at import time; reset module cache so each test
    // sees the current process.env.CRON_SECRET value.
    vi.resetModules();
    delete process.env.CRON_SECRET;
    (runAutopay as any).mockResolvedValue({
      processedCount: 1,
      successCount: 1,
      failedCount: 0,
      skippedCount: 0,
      totalAmountCents: 1234,
      errors: [],
    });
    (getAutopayProcessingSummary as any).mockReturnValue('summary');
    (getScheduledAutopayPreview as any).mockResolvedValue({ entries: [] });
    mockSelectDistinct.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ householdId: 'household-1' }, { householdId: 'household-2' }]),
      }),
    });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    vi.clearAllMocks();
  });

  it('POST returns 401 when CRON_SECRET is set and auth header missing/invalid', async () => {
    process.env.CRON_SECRET = 'secret';

    const { POST } = await import('@/app/api/cron/autopay/route');
    const req = new Request('http://localhost/api/cron/autopay', { method: 'POST' });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('cron secret');
  });

  it('POST fails CLOSED with 401 when CRON_SECRET is not configured (C-SEC-1)', async () => {
    // No CRON_SECRET set (beforeEach deletes it). An unauthenticated caller must
    // NOT be able to trigger money movement, even by supplying headers.
    const { POST } = await import('@/app/api/cron/autopay/route');
    const req = new Request('http://localhost/api/cron/autopay', {
      method: 'POST',
      headers: {
        authorization: 'Bearer anything',
        'x-household-id': 'household-1',
        'x-user-id': 'user-1',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(runAutopay).not.toHaveBeenCalled();
  });

  it('POST with ONLY the Bearer secret runs autopay for every household with enabled rules (A1)', async () => {
    // Regression: the shipped cron scheduler sends only the Authorization
    // header. The old route hard-required x-household-id/x-user-id and 400'd
    // on every scheduled trigger, so autopay never ran on a stock deployment.
    process.env.CRON_SECRET = 'secret';

    const { POST } = await import('@/app/api/cron/autopay/route');
    const req = new Request('http://localhost/api/cron/autopay', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Autopay processing completed');
    expect(data.summary).toBe('summary');
    expect(runAutopay).toHaveBeenCalledTimes(2);
    expect(runAutopay).toHaveBeenCalledWith({
      userId: null,
      householdId: 'household-1',
      runType: 'scheduled',
      dryRun: false,
    });
    expect(runAutopay).toHaveBeenCalledWith({
      userId: null,
      householdId: 'household-2',
      runType: 'scheduled',
      dryRun: false,
    });
    expect(data.stats).toEqual({
      households: 2,
      processed: 2,
      successful: 2,
      failed: 0,
      skipped: 0,
      totalAmount: 24.68,
    });
  });

  it('POST with x-household-id scopes the run to that household', async () => {
    process.env.CRON_SECRET = 'secret';

    const { POST } = await import('@/app/api/cron/autopay/route');
    const req = new Request('http://localhost/api/cron/autopay', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret',
        'x-household-id': 'household-2',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(runAutopay).toHaveBeenCalledTimes(1);
    expect(runAutopay).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'household-2' })
    );
  });

  it('POST isolates one household failure instead of failing the whole cron', async () => {
    process.env.CRON_SECRET = 'secret';
    (runAutopay as any)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        processedCount: 1,
        successCount: 1,
        failedCount: 0,
        skippedCount: 0,
        totalAmountCents: 1234,
        errors: [],
      });

    const { POST } = await import('@/app/api/cron/autopay/route');
    const req = new Request('http://localhost/api/cron/autopay', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stats.failed).toBe(1);
    expect(data.stats.successful).toBe(1);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'AUTOPAY_RUN_FAILED', message: 'boom' }),
      ])
    );
  });

  it('GET requires cron auth and fails closed when secret is unset (C-SEC-2)', async () => {
    const { GET } = await import('@/app/api/cron/autopay/route');
    const req = new Request('http://localhost/api/cron/autopay', { method: 'GET' });

    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(getScheduledAutopayPreview).not.toHaveBeenCalled();
  });

  it('GET returns preview response shape when authorized', async () => {
    process.env.CRON_SECRET = 'secret';
    (getScheduledAutopayPreview as any).mockResolvedValue({
      entries: [
        {
          householdId: 'hh-1',
          billId: 'b1',
          billName: 'Bill 1',
          occurrenceId: 'o1',
          dueDate: '2025-01-01',
          expectedAmountCents: 1000,
          autopayAmountType: 'fixed',
        },
        {
          householdId: 'hh-1',
          billId: 'b2',
          billName: 'Bill 2',
          occurrenceId: 'o2',
          dueDate: '2025-01-01',
          autopayAmountType: 'minimum_payment',
          skipReason: 'Minimum-payment autopay requires a linked liability account with a minimum payment amount',
        },
      ],
    });

    const { GET } = await import('@/app/api/cron/autopay/route');
    const req = new Request('http://localhost/api/cron/autopay', {
      method: 'GET',
      headers: { authorization: 'Bearer secret' },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // Only actionable entries count; skipped ones are listed with reasons.
    expect(data.count).toBe(1);
    expect(data.bills).toHaveLength(2);
    expect(data.bills[0]).toEqual({
      householdId: 'hh-1',
      billId: 'b1',
      billName: 'Bill 1',
      occurrenceId: 'o1',
      dueDate: '2025-01-01',
      expectedAmount: 10,
      autopayAmountType: 'fixed',
    });
    expect(data.bills[1].skipReason).toMatch(/minimum/i);
  });
});


