import { afterEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

/**
 * Production hardening item 3: scripts/migrate.mjs takes a consistent
 * VACUUM INTO snapshot of the database BEFORE applying pending migrations to
 * an existing database, so a bad deploy is reversible by copying the snapshot
 * back. A brand-new database (nothing applied yet) is not snapshotted.
 */
const SCRIPT = path.join(process.cwd(), 'scripts', 'migrate.mjs');

function writeFixtureMigrations(root: string, tags: string[], sqlByTag: Record<string, string>) {
  const dir = path.join(root, 'migrations');
  fs.mkdirSync(path.join(dir, 'meta'), { recursive: true });
  for (const tag of tags) {
    fs.writeFileSync(path.join(dir, `${tag}.sql`), sqlByTag[tag]);
  }
  fs.writeFileSync(
    path.join(dir, 'meta', '_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'sqlite',
      entries: tags.map((tag, i) => ({ idx: i, version: '6', when: 1700000000000 + i, tag, breakpoints: true })),
    })
  );
  return dir;
}

function runMigrate(dbPath: string, migrationsFolder: string) {
  return spawnSync('node', [SCRIPT], {
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
      MIGRATIONS_FOLDER: migrationsFolder,
    },
    encoding: 'utf8',
  });
}

describe('migrate.mjs pre-migration snapshot', () => {
  const cleanup: string[] = [];
  afterEach(() => {
    for (const p of cleanup) fs.rmSync(p, { recursive: true, force: true });
    cleanup.length = 0;
  });

  it('skips brand-new databases, then snapshots before applying NEW pending migrations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ul-premig-'));
    cleanup.push(root);
    const dbPath = path.join(root, 'finance.db');
    const snapDir = path.join(root, 'backups', 'pre-migration');

    // Phase 1: fresh database, one migration -> applied, but NO snapshot
    // (nothing worth saving existed yet).
    const v1 = writeFixtureMigrations(root, ['0000_init'], {
      '0000_init': 'CREATE TABLE money (id INTEGER PRIMARY KEY, cents INTEGER NOT NULL);',
    });
    const run1 = runMigrate(dbPath, v1);
    expect(run1.status).toBe(0);
    expect(fs.existsSync(snapDir)).toBe(false);

    // Seed real user data so the snapshot has something to prove.
    const db = new Database(dbPath);
    db.prepare('INSERT INTO money (cents) VALUES (12345)').run();
    db.close();

    // Phase 2: a NEW pending migration arrives -> snapshot taken BEFORE apply.
    const v2root = fs.mkdtempSync(path.join(os.tmpdir(), 'ul-premig2-'));
    cleanup.push(v2root);
    const v2 = writeFixtureMigrations(v2root, ['0000_init', '0001_add_col'], {
      '0000_init': 'CREATE TABLE money (id INTEGER PRIMARY KEY, cents INTEGER NOT NULL);',
      '0001_add_col': 'ALTER TABLE money ADD COLUMN note TEXT;',
    });
    const run2 = runMigrate(dbPath, v2);
    expect(run2.status).toBe(0);
    expect(run2.stdout).toContain('Pre-migration snapshot');

    const snapshots = fs.readdirSync(snapDir).filter((f) => f.endsWith('.db'));
    expect(snapshots.length).toBe(1);

    // The snapshot holds the PRE-migration state: data present, new column absent.
    const snap = new Database(path.join(snapDir, snapshots[0]), { readonly: true });
    expect(snap.prepare('SELECT cents FROM money').get()).toEqual({ cents: 12345 });
    const cols = snap.prepare("PRAGMA table_info('money')").all().map((c) => (c as { name: string }).name);
    expect(cols).not.toContain('note');
    snap.close();

    // Phase 3: nothing pending -> no new snapshot.
    const run3 = runMigrate(dbPath, v2);
    expect(run3.status).toBe(0);
    expect(fs.readdirSync(snapDir).filter((f) => f.endsWith('.db')).length).toBe(1);
  });
});
