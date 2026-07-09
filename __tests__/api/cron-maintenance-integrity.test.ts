import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Tier-2 hardening: the maintenance cron now checkpoints the WAL and runs
 * SQLite's on-disk corruption check. Exercised against the real test database.
 */
describe('POST /api/cron/maintenance (wal-checkpoint + integrity-check)', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'maintenance-test-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  function request(operation: string) {
    return new Request(`http://localhost/api/cron/maintenance?operation=${operation}`, {
      method: 'POST',
      headers: { authorization: 'Bearer maintenance-test-secret' },
    });
  }

  it('wal-checkpoint succeeds against the live database', async () => {
    const { POST } = await import('@/app/api/cron/maintenance/route');
    const res = await POST(request('wal-checkpoint') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    const op = body.operations.find((o: { name: string }) => o.name === 'wal-checkpoint');
    expect(op.status).toBe('success');
    expect(op.message).toContain('WAL checkpointed');
  });

  it('integrity-check reports ok for a healthy database', async () => {
    const { POST } = await import('@/app/api/cron/maintenance/route');
    const res = await POST(request('integrity-check') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    const op = body.operations.find((o: { name: string }) => o.name === 'integrity-check');
    expect(op.status).toBe('success');
    expect(op.message).toContain('ok');
  });

  it('both run as part of operation=all', async () => {
    const { POST } = await import('@/app/api/cron/maintenance/route');
    const res = await POST(request('all') as never);
    const body = await res.json();
    const names = body.operations.map((o: { name: string }) => o.name);
    expect(names).toContain('wal-checkpoint');
    expect(names).toContain('integrity-check');
  });

  it('still rejects without the cron secret', async () => {
    const { POST } = await import('@/app/api/cron/maintenance/route');
    const res = await POST(
      new Request('http://localhost/api/cron/maintenance', { method: 'POST' }) as never
    );
    expect(res.status).toBe(401);
  });
});
