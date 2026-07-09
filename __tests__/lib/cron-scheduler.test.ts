import { describe, expect, it, vi } from 'vitest';

// Plain .mjs module with an isMain guard — importable without side effects.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - untyped runtime script
import { CRON_JOBS, initializeJobState, tick } from '../../scripts/cron-scheduler.mjs';

/**
 * Production hardening item 1: the in-container scheduler that actually
 * triggers the /api/cron/* endpoints (before it, autopay and scheduled backups
 * never ran on a stock deployment).
 */
describe('cron-scheduler', () => {
  it('covers every cron endpoint the app exposes', () => {
    const scheduled = CRON_JOBS.map((j: { path: string }) => j.path.split('?')[0]);
    for (const endpoint of [
      '/api/cron/autopay',
      '/api/cron/backups',
      '/api/cron/balance-snapshots',
      '/api/cron/budget-rollover',
      '/api/cron/cleanup',
      '/api/cron/income-alerts',
      '/api/cron/maintenance',
      '/api/cron/usage-decay',
    ]) {
      expect(scheduled).toContain(endpoint);
    }
  });

  it('staggers initial runs and fires each job on its cadence', async () => {
    const jobs = [
      { path: '/api/cron/a', everyMinutes: 60 },
      { path: '/api/cron/b', everyMinutes: 1440 },
    ];
    const t0 = 1_000_000_000;
    const state = initializeJobState(jobs, t0);
    const fired: string[] = [];
    const trigger = vi.fn(async (job: { path: string }) => {
      fired.push(job.path);
    });

    // Immediately: nothing due (staggered).
    await tick(state, t0, trigger);
    expect(fired).toEqual([]);

    // After the stagger window both become due.
    await tick(state, t0 + 10 * 60_000, trigger);
    expect(fired).toEqual(['/api/cron/a', '/api/cron/b']);

    // 30 minutes later: neither cadence has elapsed.
    await tick(state, t0 + 40 * 60_000, trigger);
    expect(fired).toEqual(['/api/cron/a', '/api/cron/b']);

    // 70 minutes after the first fire: hourly job runs again, daily does not.
    await tick(state, t0 + 80 * 60_000, trigger);
    expect(fired).toEqual(['/api/cron/a', '/api/cron/b', '/api/cron/a']);
  });

  it('a failing job is logged and does not block the others', async () => {
    const jobs = [
      { path: '/api/cron/broken', everyMinutes: 60 },
      { path: '/api/cron/fine', everyMinutes: 60 },
    ];
    const t0 = 0;
    const state = initializeJobState(jobs, t0);
    const fired: string[] = [];
    const trigger = vi.fn(async (job: { path: string }) => {
      if (job.path.includes('broken')) throw new Error('endpoint exploded');
      fired.push(job.path);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await tick(state, t0 + 60 * 60_000, trigger);

    expect(fired).toEqual(['/api/cron/fine']);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/cron/broken failed'),
      'endpoint exploded'
    );
    errorSpy.mockRestore();
  });
});
