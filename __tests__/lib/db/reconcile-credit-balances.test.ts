import { afterEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

/**
 * C-MATH-1 follow-up: scripts/reconcile-credit-balances.mjs detects credit /
 * line-of-credit balances still carrying the pre-audit ASSET-sign offset (a
 * charge used to DECREASE the stored balance) and can correct them — either to
 * a user-asserted statement balance or by replaying the ledger under the
 * liability convention.
 *
 * These tests build a minimal fixture DB with the legacy corruption baked in.
 */
const SCRIPT = path.join(process.cwd(), 'scripts', 'reconcile-credit-balances.mjs');

function makeFixtureDb(dir: string): string {
  const dbPath = path.join(dir, 'fixture.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      current_balance REAL DEFAULT 0,
      current_balance_cents INTEGER,
      updated_at TEXT
    ) STRICT;
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL
    ) STRICT;
  `);

  // Legacy-corrupted credit card: $500 of charges and a $100 payment were
  // applied with the ASSET rule, driving the stored balance to -$400 even
  // though the user actually OWES $400. Note the legacy negative amount
  // encoding on expenses.
  db.prepare(
    "INSERT INTO accounts VALUES ('cc1', 'Legacy Card', 'credit', -400, -40000, NULL)"
  ).run();
  db.prepare("INSERT INTO transactions VALUES ('t1', 'cc1', 'expense', -30000)").run();
  db.prepare("INSERT INTO transactions VALUES ('t2', 'cc1', 'expense', 20000)").run();
  db.prepare("INSERT INTO transactions VALUES ('t3', 'cc1', 'income', 10000)").run();

  // Healthy line of credit written by the NEW engine: owes $250 from $300 of
  // draws minus a $50 payment. Implied opening = 0 -> no flag.
  db.prepare(
    "INSERT INTO accounts VALUES ('loc1', 'Healthy LOC', 'line_of_credit', 250, 25000, NULL)"
  ).run();
  db.prepare("INSERT INTO transactions VALUES ('t4', 'loc1', 'expense', 30000)").run();
  db.prepare("INSERT INTO transactions VALUES ('t5', 'loc1', 'transfer_in', 5000)").run();

  // Asset account: must be ignored entirely.
  db.prepare(
    "INSERT INTO accounts VALUES ('chk1', 'Checking', 'checking', 100, 10000, NULL)"
  ).run();

  db.close();
  return dbPath;
}

function run(dbPath: string, args: string[] = []) {
  return spawnSync('node', [SCRIPT, ...args], {
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    encoding: 'utf8',
  });
}

describe('reconcile-credit-balances (C-MATH-1 legacy repair)', () => {
  const cleanup: string[] = [];
  afterEach(() => {
    for (const p of cleanup) fs.rmSync(p, { recursive: true, force: true });
    cleanup.length = 0;
  });

  function fixture(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ul-creditfix-'));
    cleanup.push(dir);
    return makeFixtureDb(dir);
  }

  it('report flags the legacy-sign account and clears the healthy one', () => {
    const dbPath = fixture();
    const res = run(dbPath);
    expect(res.status).toBe(0);
    // Legacy card: stored -$400, ledger delta +$400 (500 charges - 100 payment),
    // implied opening -$800 -> flagged twice.
    expect(res.stdout).toContain('Legacy Card');
    expect(res.stdout).toMatch(/stored owed:\s+\$-400\.00/);
    expect(res.stdout).toMatch(/ledger delta.*\+\$400\.00/);
    expect(res.stdout).toMatch(/implied opening owed: \$-800\.00/);
    expect(res.stdout).toContain('legacy-sign suspect');
    // Healthy LOC: delta +$250, implied opening $0 -> clean.
    expect(res.stdout).toMatch(/Healthy LOC[\s\S]*?no legacy-sign signature/);
    // Asset account never appears.
    expect(res.stdout).not.toContain('Checking');
    // Read-only: stored balances untouched.
    const db = new Database(dbPath, { readonly: true });
    expect(db.prepare("SELECT current_balance_cents c FROM accounts WHERE id='cc1'").get()).toEqual({ c: -40000 });
    db.close();
  });

  it('--fix-account --owed sets the asserted statement balance (both columns) and backs up first', () => {
    const dbPath = fixture();
    const res = run(dbPath, ['--fix-account', 'cc1', '--owed', '400']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('backup written');

    const db = new Database(dbPath, { readonly: true });
    const row = db
      .prepare("SELECT current_balance b, current_balance_cents c FROM accounts WHERE id='cc1'")
      .get() as { b: number; c: number };
    db.close();
    expect(row.c).toBe(40000);
    expect(row.b).toBe(400);

    const backups = fs.readdirSync(path.dirname(dbPath)).filter((f) => f.includes('bak-credit-fix'));
    expect(backups.length).toBe(1);
  });

  it('--fix-account --from-ledger derives owed from the replayed history', () => {
    const dbPath = fixture();
    const res = run(dbPath, ['--fix-account', 'cc1', '--from-ledger']);
    expect(res.status).toBe(0);

    const db = new Database(dbPath, { readonly: true });
    const row = db
      .prepare("SELECT current_balance_cents c FROM accounts WHERE id='cc1'")
      .get() as { c: number };
    db.close();
    // 300 + 200 charges - 100 payment = $400 owed.
    expect(row.c).toBe(40000);
  });

  it('--from-ledger honors an explicit opening balance', () => {
    const dbPath = fixture();
    const res = run(dbPath, ['--fix-account', 'cc1', '--from-ledger', '--opening', '50']);
    expect(res.status).toBe(0);
    const db = new Database(dbPath, { readonly: true });
    const row = db
      .prepare("SELECT current_balance_cents c FROM accounts WHERE id='cc1'")
      .get() as { c: number };
    db.close();
    expect(row.c).toBe(45000);
  });

  it('refuses to touch asset accounts', () => {
    const dbPath = fixture();
    const res = run(dbPath, ['--fix-account', 'chk1', '--owed', '0']);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('only corrects credit / line_of_credit');
  });

  it('requires an explicit target (no silent default fix)', () => {
    const dbPath = fixture();
    const res = run(dbPath, ['--fix-account', 'cc1']);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('--owed');
  });
});
