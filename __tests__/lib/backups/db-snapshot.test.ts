import { afterEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

import { snapshotSqliteDatabase } from '@/lib/backups/db-snapshot';

/**
 * Production hardening item 2: raw DB-file snapshots via VACUUM INTO — the
 * consistent, restore-by-copy backup layer under the JSON exports.
 */
describe('snapshotSqliteDatabase', () => {
  const cleanup: string[] = [];
  afterEach(() => {
    for (const p of cleanup) fs.rmSync(p, { recursive: true, force: true });
    cleanup.length = 0;
  });

  function makeDb(): { db: Database.Database; dir: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ul-snapshot-'));
    cleanup.push(dir);
    const db = new Database(path.join(dir, 'finance.db'));
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT) STRICT');
    db.prepare('INSERT INTO t (v) VALUES (?)').run('money');
    return { db, dir };
  }

  it('writes a consistent, openable snapshot of a live WAL database', () => {
    const { db, dir } = makeDb();
    const result = snapshotSqliteDatabase(db, { now: new Date('2026-07-09T12:00:00Z') });

    expect(result.created).toBe(true);
    expect(result.snapshotPath).toContain(path.join(dir, 'backups', 'db-snapshots'));

    const snapshot = new Database(result.snapshotPath!, { readonly: true });
    expect(snapshot.prepare('SELECT v FROM t').get()).toEqual({ v: 'money' });
    expect(snapshot.pragma('integrity_check', { simple: true })).toBe('ok');
    snapshot.close();
    db.close();
  });

  it('age-gates: skips when the newest snapshot is fresh, refreshes when stale', () => {
    const { db } = makeDb();
    const first = snapshotSqliteDatabase(db, { now: new Date('2026-07-09T12:00:00Z') });
    expect(first.created).toBe(true);

    // 1 hour later: fresh snapshot exists -> skip.
    const skipped = snapshotSqliteDatabase(db, { now: new Date('2026-07-09T13:00:00Z') });
    expect(skipped.created).toBe(false);
    expect(skipped.skippedReason).toBe('recent-snapshot-exists');

    // Age the existing snapshot on disk past the gate -> a new one is taken.
    const old = Date.now() - 25 * 3600 * 1000;
    fs.utimesSync(first.snapshotPath!, old / 1000, old / 1000);
    const refreshed = snapshotSqliteDatabase(db, { now: new Date('2026-07-10T13:00:00Z') });
    expect(refreshed.created).toBe(true);
    db.close();
  });

  it('prunes beyond the retention count, oldest first', () => {
    const { db, dir } = makeDb();
    const snapDir = path.join(dir, 'backups', 'db-snapshots');
    // Take 4 snapshots with retention 2, disabling the age gate.
    for (let i = 0; i < 4; i++) {
      const result = snapshotSqliteDatabase(db, {
        retain: 2,
        minAgeHours: 0,
        now: new Date(Date.UTC(2026, 6, 1 + i)),
      });
      expect(result.created).toBe(true);
      // Space the mtimes so ordering is deterministic.
      const t = Date.UTC(2026, 6, 1 + i) / 1000;
      fs.utimesSync(result.snapshotPath!, t, t);
    }
    const remaining = fs.readdirSync(snapDir).filter((f) => f.endsWith('.db'));
    expect(remaining.length).toBe(2);
    db.close();
  });

  it('refuses to snapshot a non-file-backed database', () => {
    const db = new Database(':memory:');
    const result = snapshotSqliteDatabase(db);
    expect(result.created).toBe(false);
    expect(result.skippedReason).toBe('db-not-file-backed');
    db.close();
  });
});
