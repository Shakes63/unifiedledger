/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/bills/autopay-processor', () => ({
  processAllAutopayBills: vi.fn(),
  getAutopayDueToday: vi.fn(),
}));

vi.mock('@/lib/notifications/autopay-notifications', () => ({
  getAutopayProcessingSummary: vi.fn(),
}));

import { processAllAutopayBills, getAutopayDueToday } from '@/lib/bills/autopay-processor';
import { getAutopayProcessingSummary } from '@/lib/notifications/autopay-notifications';

describe('app/api/cron/autopay/route', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    // Route module captures CRON_SECRET at import time; reset module cache so each test
    // sees the current process.env.CRON_SECRET value.
    vi.resetModules();
    delete process.env.CRON_SECRET;
    (processAllAutopayBills as any).mockResolvedValue({
      processed: 1,
      successful: 1,
      failed: 0,
      skipped: 0,
      totalAmount: 12.34,
      errors: [],
      successes: [],
    });
    (getAutopayProcessingSummary as any).mockReturnValue('summary');
    (getAutopayDueToday as any).mockResolvedValue({ count: 0, bills: [] });
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
    expect(data.error).toContain('Invalid cron secret');
  });

  it('POST returns 200 and expected response shape when CRON_SECRET matches', async () => {
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
    expect(data.stats).toEqual({
      processed: 1,
      successful: 1,
      failed: 0,
      skipped: 0,
      totalAmount: 12.34,
    });
  });

  it('POST returns 500 when processor throws', async () => {
    (processAllAutopayBills as any).mockRejectedValue(new Error('boom'));

    const { POST } = await import('@/app/api/cron/autopay/route');
    const req = new Request('http://localhost/api/cron/autopay', { method: 'POST' });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to process autopay bills');
    expect(data.message).toBe('boom');
  });

  it('GET returns preview response shape', async () => {
    (getAutopayDueToday as any).mockResolvedValue({
      count: 2,
      bills: [
        {
          billId: 'b1',
          billName: 'Bill 1',
          instanceId: 'i1',
          dueDate: '2025-01-01',
          expectedAmount: 10,
          autopayAccountId: 'a1',
          autopayAmountType: 'fixed',
        },
      ],
    });

    const { GET } = await import('@/app/api/cron/autopay/route');
    const req = new Request('http://localhost/api/cron/autopay', { method: 'GET' });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
    expect(Array.isArray(data.bills)).toBe(true);
    // ensure non-sensitive mapping
    expect(data.bills[0]).toEqual({
      billId: 'b1',
      billName: 'Bill 1',
      dueDate: '2025-01-01',
      expectedAmount: 10,
      autopayAmountType: 'fixed',
    });
  });
});


