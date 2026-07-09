/**
 * Raw SQLite-file snapshots (production hardening item 2).
 *
 * The scheduled JSON backups are per-household exports whose restore path is
 * an import — useful, but never drill-tested. This adds the durable layer: a
 * consistent copy of the ENTIRE database file taken with `VACUUM INTO`, which
 * is atomic and safe while the app is writing (unlike a plain file copy of a
 * live WAL database, which can tear). Restore = stop the container, copy the
 * snapshot back over finance.db, start.
 *
 * Snapshots land next to the DB in <db dir>/backups/db-snapshots/. That is
 * still the same disk — sync that directory off-box (Unraid: rclone/rsync the
 * /config share) for real durability; see README "Backup / restore".
 */
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type DatabaseType from 'better-sqlite3';

const SNAPSHOT_PREFIX = 'db-snapshot-';

export interface SnapshotOptions {
  /** Directory for snapshots; defaults to <db dir>/backups/db-snapshots. */
  directory?: string;
  /** How many snapshots to keep (oldest pruned first). */
  retain?: number;
  /** Skip when the newest snapshot is younger than this (hours). */
  minAgeHours?: number;
  /** Clock override for tests. */
  now?: Date;
}

export interface SnapshotResult {
  created: boolean;
  skippedReason?: 'db-not-file-backed' | 'recent-snapshot-exists';
  snapshotPath?: string;
  prunedCount: number;
}

function listSnapshots(directory: string): Array<{ path: string; mtimeMs: number }> {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.startsWith(SNAPSHOT_PREFIX) && name.endsWith('.db'))
    .map((name) => {
      const fullPath = join(directory, name);
      return { path: fullPath, mtimeMs: statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * Takes a consistent snapshot of the given better-sqlite3 connection's
 * database via VACUUM INTO, age-gated and with retention pruning.
 */
export function snapshotSqliteDatabase(
  connection: DatabaseType.Database,
  options: SnapshotOptions = {}
): SnapshotResult {
  const dbPath = connection.name;
  if (!dbPath || dbPath === ':memory:' || dbPath === '') {
    return { created: false, skippedReason: 'db-not-file-backed', prunedCount: 0 };
  }

  const now = options.now ?? new Date();
  const retain = options.retain ?? 7;
  const minAgeHours = options.minAgeHours ?? 20;
  const directory = options.directory ?? join(dirname(dbPath), 'backups', 'db-snapshots');

  const existing = listSnapshots(directory);
  const newest = existing[0];
  if (newest && now.getTime() - newest.mtimeMs < minAgeHours * 3600 * 1000) {
    return { created: false, skippedReason: 'recent-snapshot-exists', prunedCount: 0 };
  }

  mkdirSync(directory, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const snapshotPath = join(directory, `${SNAPSHOT_PREFIX}${stamp}.db`);
  // VACUUM INTO writes a compacted, transactionally-consistent copy — safe to
  // run against a live WAL database. Escape single quotes for the SQL literal.
  connection.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);

  // Prune beyond the retention count (newest first, so slice off the tail).
  const all = listSnapshots(directory);
  const toPrune = all.slice(retain);
  for (const stale of toPrune) {
    try {
      unlinkSync(stale.path);
    } catch (error) {
      console.error(`[db-snapshot] failed pruning ${stale.path}:`, error);
    }
  }

  return { created: true, snapshotPath, prunedCount: toPrune.length };
}

/**
 * Cron-facing wrapper: snapshots the app database. Called from the hourly
 * backups cron; the age gate means the file is refreshed roughly daily.
 */
export async function createAppDatabaseSnapshot(): Promise<SnapshotResult> {
  const { sqlite } = await import('@/lib/db');
  return snapshotSqliteDatabase(sqlite);
}
