#!/usr/bin/env node
/**
 * In-container cron scheduler.
 *
 * The app's scheduled work (autopay, backups, balance snapshots, rollover,
 * cleanup, alerts, maintenance) lives behind fail-closed /api/cron/* endpoints
 * — but nothing in the container ever CALLED them, so on a stock deployment
 * autopay never ran and scheduled backups never happened unless the operator
 * wired up external cron jobs by hand.
 *
 * This process is spawned by docker-entrypoint.mjs alongside the server. It
 * waits for /api/health, then triggers each endpoint on its cadence with
 * `Authorization: Bearer $CRON_SECRET`. Every endpoint is idempotent or
 * due-ness-aware server-side (autopay has per-run/row guards; the backup
 * scheduler only processes households with nextBackupAt <= now), so a restart
 * re-triggering a job is harmless.
 *
 * Set CRON_SCHEDULER_DISABLED=true to opt out (e.g. when using external cron).
 */
import { fileURLToPath } from 'node:url';

// Cadences. Endpoints gate themselves, so these only bound trigger frequency.
export const CRON_JOBS = [
  // hourly: the backup scheduler picks up households due for backup; the
  // route also refreshes the daily raw-DB snapshot (age-gated server-side).
  { path: '/api/cron/backups', everyMinutes: 60 },
  // 6-hourly: autopay is idempotent per (household, runDate) and per row,
  // with 14-day catch-up — frequent triggers just pick work up sooner.
  { path: '/api/cron/autopay', everyMinutes: 360 },
  { path: '/api/cron/balance-snapshots', everyMinutes: 1440 },
  { path: '/api/cron/budget-rollover', everyMinutes: 1440 },
  { path: '/api/cron/income-alerts', everyMinutes: 1440 },
  // daily: retention cleanup + orphaned-link reaper + ANALYZE/VACUUM live here.
  { path: '/api/cron/cleanup', everyMinutes: 1440 },
  { path: '/api/cron/usage-decay', everyMinutes: 10080 },
  { path: '/api/cron/maintenance?operation=all', everyMinutes: 10080 },
];

const TICK_MS = 60_000;
// Stagger initial runs so a fresh boot doesn't fire everything at once.
const INITIAL_STAGGER_MS = 2 * 60_000;

export function initializeJobState(jobs, nowMs) {
  return jobs.map((job, index) => ({
    ...job,
    nextRunAtMs: nowMs + (index + 1) * INITIAL_STAGGER_MS,
  }));
}

/**
 * Runs everything currently due and reschedules it. Failures are logged and
 * rescheduled normally — one broken endpoint must not stall the others.
 */
export async function tick(jobState, nowMs, triggerJob) {
  for (const job of jobState) {
    if (nowMs < job.nextRunAtMs) continue;
    // Reschedule BEFORE running so a hung request can't double-fire later.
    job.nextRunAtMs = nowMs + job.everyMinutes * 60_000;
    try {
      await triggerJob(job);
    } catch (error) {
      console.error(`[cron-scheduler] ${job.path} failed:`, error?.message ?? error);
    }
  }
}

async function waitForServer(baseUrl, { attempts = 60, delayMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return true;
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

async function main() {
  if (process.env.CRON_SCHEDULER_DISABLED === 'true') {
    console.log('[cron-scheduler] disabled via CRON_SCHEDULER_DISABLED — exiting.');
    return;
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    console.error(
      '[cron-scheduler] CRON_SECRET is not set — scheduled jobs (autopay, backups, ' +
        'cleanup) will NOT run. The entrypoint normally generates one; set it explicitly ' +
        'or fix /config permissions.'
    );
    process.exit(1);
  }

  const port = process.env.PORT || '3000';
  const baseUrl = `http://127.0.0.1:${port}`;

  const up = await waitForServer(baseUrl);
  if (!up) {
    console.error('[cron-scheduler] server never became healthy — exiting.');
    process.exit(1);
  }

  console.log(
    `[cron-scheduler] started; ${CRON_JOBS.length} jobs, first runs staggered over ` +
      `${(CRON_JOBS.length * INITIAL_STAGGER_MS) / 60_000} minutes.`
  );

  const jobState = initializeJobState(CRON_JOBS, Date.now());
  const trigger = async (job) => {
    const res = await fetch(`${baseUrl}${job.path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const level = res.ok ? 'log' : 'error';
    console[level](`[cron-scheduler] POST ${job.path} -> ${res.status}`);
  };
  while (true) {
    await tick(jobState, Date.now(), trigger);
    await new Promise((resolve) => setTimeout(resolve, TICK_MS));
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error('[cron-scheduler] fatal:', error);
    process.exit(1);
  });
}
