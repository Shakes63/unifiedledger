/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/backups/backup-scheduler', () => ({
  processScheduledBackups: vi.fn(),
}));

import { processScheduledBackups } from '@/lib/backups/backup-scheduler';

describe('app/api/cron/backups/route', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.CRON_SECRET;
    (processScheduledBackups as any).mockResolvedValue({ processed: 0, created: 0, failed: 0 });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    vi.clearAllMocks();
  });

  it('POST returns 401 when CRON_SECRET is missing/invalid', async () => {
    process.env.CRON_SECRET = 'secret';

    const { POST } = await import('@/app/api/cron/backups/route');
    const req = new Request('http://localhost/api/cron/backups', { method: 'POST' });

    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });

  it('POST returns 200 and summary when CRON_SECRET matches', async () => {
    process.env.CRON_SECRET = 'secret';
    (processScheduledBackups as any).mockResolvedValue({ processed: 2, created: 2, failed: 0 });

    const { POST } = await import('@/app/api/cron/backups/route');
    const req = new Request('http://localhost/api/cron/backups', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
    });

    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.summary).toEqual({ processed: 2, created: 2, failed: 0 });
    expect(typeof data.timestamp).toBe('string');
  });

  it('GET returns scheduler configuration shape', async () => {
    const { GET } = await import('@/app/api/cron/backups/route');
    const req = new Request('http://localhost/api/cron/backups', { method: 'GET' });

    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.endpoint).toBe('/api/cron/backups');
    expect(Array.isArray(data.operations)).toBe(true);
  });
});
