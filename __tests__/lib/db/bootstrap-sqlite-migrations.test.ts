import { afterEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

function migrationHash(tag: string): string {
  const sqlPath = path.join(process.cwd(), 'drizzle', 'sqlite', `${tag}.sql`);
  return crypto.createHash('sha256').update(fs.readFileSync(sqlPath, 'utf8')).digest('hex');
}

describe('bootstrap-sqlite-migrations script', () => {
  const cleanupPaths: string[] = [];

  afterEach(() => {
    for (const p of cleanupPaths) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
    cleanupPaths.length = 0;
  });

  it('seeds only migrations that appear applied and leaves pending migrations unapplied', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ul-bootstrap-'));
    cleanupPaths.push(dir);

    const dbPath = path.join(dir, 'bootstrap.db');
    const db = new Database(dbPath);

    db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        include_in_discretionary INTEGER,
        current_balance REAL,
        available_balance REAL,
        credit_limit REAL
      );
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        amount REAL,
        transfer_source_account_id TEXT,
        transfer_destination_account_id TEXT
      );
      CREATE TABLE transaction_splits (
        id TEXT PRIMARY KEY,
        amount REAL
      );
      CREATE TABLE transfers (
        id TEXT PRIMARY KEY,
        household_id TEXT,
        amount REAL,
        fees REAL
      );
      CREATE TABLE households (id TEXT PRIMARY KEY);
      CREATE TABLE household_members (id TEXT PRIMARY KEY);
      CREATE TABLE bill_instances (id TEXT PRIMARY KEY, payment_status TEXT);
      CREATE TABLE bill_payments (id TEXT PRIMARY KEY, principal_amount REAL);
      CREATE TABLE bill_instance_allocations (id TEXT PRIMARY KEY);
      CREATE TABLE user (id TEXT PRIMARY KEY);
    `);
    db.close();

    const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
    const run1 = spawnSync('node', ['scripts/bootstrap-sqlite-migrations.mjs'], {
      cwd: process.cwd(),
      env,
      encoding: 'utf8',
    });
    expect(run1.status).toBe(0);

    const verifyDb = new Database(dbPath);
    const rows = verifyDb.prepare('SELECT hash FROM "__drizzle_migrations"').all() as { hash: string }[];
    const hashes = new Set(rows.map((r) => r.hash));

    // 0000..0005 should be seeded; 0006 should remain pending (no cents columns yet).
    expect(hashes.has(migrationHash('0000_stale_bill_hollister'))).toBe(true);
    expect(hashes.has(migrationHash('0005_add_transaction_transfer_account_links'))).toBe(true);
    expect(hashes.has(migrationHash('0006_add_money_cents_columns'))).toBe(false);
    expect(rows.length).toBe(6);
    verifyDb.close();

    // Idempotent rerun should not duplicate rows.
    const run2 = spawnSync('node', ['scripts/bootstrap-sqlite-migrations.mjs'], {
      cwd: process.cwd(),
      env,
      encoding: 'utf8',
    });
    expect(run2.status).toBe(0);

    const verifyDb2 = new Database(dbPath);
    const rowCount = (verifyDb2.prepare('SELECT COUNT(*) as c FROM "__drizzle_migrations"').get() as { c: number }).c;
    expect(rowCount).toBe(6);
    verifyDb2.close();
  });
});
