import { afterEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

function runSqliteMigration(db: Database.Database, sqlFilePath: string) {
  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    db.exec(statement);
  }
}

describe('sqlite money-cents migration', () => {
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

  it('backfills cents columns and keeps them in sync via triggers', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ul-money-cents-'));
    cleanupPaths.push(dir);
    const dbPath = path.join(dir, 'money-cents.db');
    const db = new Database(dbPath);

    db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        current_balance REAL,
        available_balance REAL,
        credit_limit REAL
      );
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        amount REAL
      );
      CREATE TABLE transaction_splits (
        id TEXT PRIMARY KEY,
        amount REAL
      );
      CREATE TABLE transfers (
        id TEXT PRIMARY KEY,
        amount REAL,
        fees REAL
      );

      INSERT INTO accounts (id, current_balance, available_balance, credit_limit)
      VALUES ('a1', 123.45, 100.50, 5000.25);
      INSERT INTO transactions (id, amount) VALUES ('t1', 12.34);
      INSERT INTO transaction_splits (id, amount) VALUES ('s1', 3.33);
      INSERT INTO transfers (id, amount, fees) VALUES ('tr1', 99.99, 1.5);
    `);

    runSqliteMigration(db, path.join(process.cwd(), 'drizzle', 'sqlite', '0006_add_money_cents_columns.sql'));

    const account = db
      .prepare(
        'SELECT current_balance_cents, available_balance_cents, credit_limit_cents FROM accounts WHERE id = ?'
      )
      .get('a1') as Record<string, number>;
    expect(account.current_balance_cents).toBe(12345);
    expect(account.available_balance_cents).toBe(10050);
    expect(account.credit_limit_cents).toBe(500025);

    const tx = db.prepare('SELECT amount_cents FROM transactions WHERE id = ?').get('t1') as { amount_cents: number };
    const split = db
      .prepare('SELECT amount_cents FROM transaction_splits WHERE id = ?')
      .get('s1') as { amount_cents: number };
    const transfer = db
      .prepare('SELECT amount_cents, fees_cents FROM transfers WHERE id = ?')
      .get('tr1') as { amount_cents: number; fees_cents: number };

    expect(tx.amount_cents).toBe(1234);
    expect(split.amount_cents).toBe(333);
    expect(transfer.amount_cents).toBe(9999);
    expect(transfer.fees_cents).toBe(150);

    db.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(42.01, 't1');
    db.prepare('UPDATE transfers SET amount = ?, fees = ? WHERE id = ?').run(10.25, 0.99, 'tr1');
    db.prepare('UPDATE accounts SET current_balance = ?, available_balance = ?, credit_limit = ? WHERE id = ?').run(
      250.12,
      240.02,
      5050.5,
      'a1'
    );

    const txAfter = db.prepare('SELECT amount_cents FROM transactions WHERE id = ?').get('t1') as { amount_cents: number };
    const transferAfter = db
      .prepare('SELECT amount_cents, fees_cents FROM transfers WHERE id = ?')
      .get('tr1') as { amount_cents: number; fees_cents: number };
    const accountAfter = db
      .prepare(
        'SELECT current_balance_cents, available_balance_cents, credit_limit_cents FROM accounts WHERE id = ?'
      )
      .get('a1') as Record<string, number>;

    expect(txAfter.amount_cents).toBe(4201);
    expect(transferAfter.amount_cents).toBe(1025);
    expect(transferAfter.fees_cents).toBe(99);
    expect(accountAfter.current_balance_cents).toBe(25012);
    expect(accountAfter.available_balance_cents).toBe(24002);
    expect(accountAfter.credit_limit_cents).toBe(505050);

    db.close();
  });
});
