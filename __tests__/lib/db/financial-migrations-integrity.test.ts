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

function sqliteMigrationPath(tag: string) {
  return path.join(process.cwd(), 'drizzle', 'sqlite', `${tag}.sql`);
}

describe('financial migration integrity (sqlite 0004-0008)', () => {
  const cleanupPaths: string[] = [];

  afterEach(() => {
    for (const targetPath of cleanupPaths) {
      try {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
    cleanupPaths.length = 0;
  });

  it('preserves financial totals while backfilling household scope, transfer linkage, and cents columns', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ul-fin-migrations-'));
    cleanupPaths.push(dir);
    const dbPath = path.join(dir, 'financial-migrations.db');
    const db = new Database(dbPath);

    db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        household_id TEXT,
        current_balance REAL,
        available_balance REAL,
        credit_limit REAL
      );

      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        household_id TEXT,
        account_id TEXT,
        type TEXT,
        amount REAL,
        merchant_id TEXT,
        transfer_id TEXT
      );

      CREATE TABLE transaction_splits (
        id TEXT PRIMARY KEY,
        amount REAL
      );

      CREATE TABLE transfers (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        from_transaction_id TEXT,
        to_transaction_id TEXT,
        from_account_id TEXT,
        to_account_id TEXT,
        amount REAL,
        fees REAL
      );

      INSERT INTO accounts (id, user_id, household_id, current_balance, available_balance, credit_limit) VALUES
        ('acc-src', 'user-1', 'hh-1', 1000.12, 900.01, 5000.55),
        ('acc-dst', 'user-1', 'hh-1', 250.75, 250.75, 0),
        ('acc-hh2', 'user-1', 'hh-2', 999.99, 999.99, 1000.00);

      INSERT INTO transactions (id, user_id, household_id, account_id, type, amount, merchant_id, transfer_id) VALUES
        ('tx-out', 'user-1', 'hh-1', 'acc-src', 'transfer_out', 75.25, '', 'acc-dst'),
        ('tx-in', 'user-1', 'hh-1', 'acc-dst', 'transfer_in', 75.25, 'acc-src', 'tx-out'),
        ('tx-exp', 'user-1', 'hh-1', 'acc-src', 'expense', 12.34, NULL, NULL),
        ('tx-hh2', 'user-1', 'hh-2', 'acc-hh2', 'transfer_out', 10.00, NULL, 'acc-dst');

      INSERT INTO transaction_splits (id, amount) VALUES
        ('split-1', 5.67),
        ('split-2', 1.23);

      INSERT INTO transfers (id, user_id, from_transaction_id, to_transaction_id, from_account_id, to_account_id, amount, fees) VALUES
        ('tr-1', 'user-1', 'tx-out', 'tx-in', 'acc-src', 'acc-dst', 75.25, 1.11),
        ('tr-2', 'user-1', NULL, NULL, 'acc-hh2', 'acc-dst', 10.00, 0.25);
    `);

    const before = {
      transactionCount: (db.prepare('SELECT COUNT(*) AS c FROM transactions').get() as { c: number }).c,
      transferCount: (db.prepare('SELECT COUNT(*) AS c FROM transfers').get() as { c: number }).c,
      splitCount: (db.prepare('SELECT COUNT(*) AS c FROM transaction_splits').get() as { c: number }).c,
      txAmountSum: (db.prepare('SELECT SUM(amount) AS s FROM transactions').get() as { s: number }).s,
      transferAmountSum: (db.prepare('SELECT SUM(amount) AS s FROM transfers').get() as { s: number }).s,
      transferFeesSum: (db.prepare('SELECT SUM(fees) AS s FROM transfers').get() as { s: number }).s,
      splitAmountSum: (db.prepare('SELECT SUM(amount) AS s FROM transaction_splits').get() as { s: number }).s,
      accountBalanceSum: (db.prepare('SELECT SUM(current_balance) AS s FROM accounts').get() as { s: number }).s,
    };

    runSqliteMigration(db, sqliteMigrationPath('0004_add_transfers_household_scope'));
    runSqliteMigration(db, sqliteMigrationPath('0005_add_transaction_transfer_account_links'));
    runSqliteMigration(db, sqliteMigrationPath('0006_add_money_cents_columns'));
    runSqliteMigration(db, sqliteMigrationPath('0007_enforce_money_cents_non_null'));
    runSqliteMigration(db, sqliteMigrationPath('0008_add_money_cents_integrity_guards'));

    const after = {
      transactionCount: (db.prepare('SELECT COUNT(*) AS c FROM transactions').get() as { c: number }).c,
      transferCount: (db.prepare('SELECT COUNT(*) AS c FROM transfers').get() as { c: number }).c,
      splitCount: (db.prepare('SELECT COUNT(*) AS c FROM transaction_splits').get() as { c: number }).c,
      txAmountSum: (db.prepare('SELECT SUM(amount) AS s FROM transactions').get() as { s: number }).s,
      transferAmountSum: (db.prepare('SELECT SUM(amount) AS s FROM transfers').get() as { s: number }).s,
      transferFeesSum: (db.prepare('SELECT SUM(fees) AS s FROM transfers').get() as { s: number }).s,
      splitAmountSum: (db.prepare('SELECT SUM(amount) AS s FROM transaction_splits').get() as { s: number }).s,
      accountBalanceSum: (db.prepare('SELECT SUM(current_balance) AS s FROM accounts').get() as { s: number }).s,
    };

    expect(after.transactionCount).toBe(before.transactionCount);
    expect(after.transferCount).toBe(before.transferCount);
    expect(after.splitCount).toBe(before.splitCount);
    expect(after.txAmountSum).toBeCloseTo(before.txAmountSum, 8);
    expect(after.transferAmountSum).toBeCloseTo(before.transferAmountSum, 8);
    expect(after.transferFeesSum).toBeCloseTo(before.transferFeesSum, 8);
    expect(after.splitAmountSum).toBeCloseTo(before.splitAmountSum, 8);
    expect(after.accountBalanceSum).toBeCloseTo(before.accountBalanceSum, 8);

    const tr1 = db
      .prepare('SELECT household_id, amount_cents, fees_cents FROM transfers WHERE id = ?')
      .get('tr-1') as { household_id: string; amount_cents: number; fees_cents: number };
    const tr2 = db
      .prepare('SELECT household_id, amount_cents, fees_cents FROM transfers WHERE id = ?')
      .get('tr-2') as { household_id: string; amount_cents: number; fees_cents: number };

    expect(tr1.household_id).toBe('hh-1');
    expect(tr2.household_id).toBe('hh-2');
    expect(tr1.amount_cents).toBe(7525);
    expect(tr1.fees_cents).toBe(111);
    expect(tr2.amount_cents).toBe(1000);
    expect(tr2.fees_cents).toBe(25);

    const txOut = db
      .prepare(
        'SELECT transfer_source_account_id, transfer_destination_account_id, amount_cents FROM transactions WHERE id = ?'
      )
      .get('tx-out') as {
      transfer_source_account_id: string | null;
      transfer_destination_account_id: string | null;
      amount_cents: number;
    };
    const txIn = db
      .prepare(
        'SELECT transfer_source_account_id, transfer_destination_account_id, amount_cents FROM transactions WHERE id = ?'
      )
      .get('tx-in') as {
      transfer_source_account_id: string | null;
      transfer_destination_account_id: string | null;
      amount_cents: number;
    };
    const txExp = db.prepare('SELECT amount_cents FROM transactions WHERE id = ?').get('tx-exp') as { amount_cents: number };
    const split1 = db.prepare('SELECT amount_cents FROM transaction_splits WHERE id = ?').get('split-1') as { amount_cents: number };
    const accountSource = db
      .prepare(
        'SELECT current_balance_cents, available_balance_cents, credit_limit_cents FROM accounts WHERE id = ?'
      )
      .get('acc-src') as {
      current_balance_cents: number;
      available_balance_cents: number;
      credit_limit_cents: number;
    };

    expect(txOut.transfer_source_account_id).toBe('acc-src');
    expect(txOut.transfer_destination_account_id).toBe('acc-dst');
    expect(txIn.transfer_source_account_id).toBe('acc-src');
    expect(txIn.transfer_destination_account_id).toBe('acc-dst');

    expect(txOut.amount_cents).toBe(7525);
    expect(txIn.amount_cents).toBe(7525);
    expect(txExp.amount_cents).toBe(1234);
    expect(split1.amount_cents).toBe(567);

    expect(accountSource.current_balance_cents).toBe(100012);
    expect(accountSource.available_balance_cents).toBe(90001);
    expect(accountSource.credit_limit_cents).toBe(500055);

    // 0008 guardrails: direct cents drift/null updates must fail.
    expect(() =>
      db.prepare('UPDATE transactions SET amount_cents = NULL WHERE id = ?').run('tx-exp')
    ).toThrow('transactions money cents integrity check failed');
    expect(() =>
      db.prepare('UPDATE transactions SET amount_cents = ? WHERE id = ?').run(1, 'tx-exp')
    ).toThrow('transactions money cents integrity check failed');
    expect(() =>
      db.prepare('UPDATE transfers SET fees_cents = ? WHERE id = ?').run(1, 'tr-1')
    ).toThrow('transfers money cents integrity check failed');
    expect(() =>
      db.prepare('UPDATE accounts SET current_balance_cents = current_balance_cents + 1 WHERE id = ?').run('acc-src')
    ).toThrow('accounts money cents integrity check failed');

    // Decimal-only updates still succeed and re-sync cents.
    db.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(15.99, 'tx-exp');
    db.prepare('UPDATE transfers SET amount = ?, fees = ? WHERE id = ?').run(12.34, 0.5, 'tr-1');
    db.prepare('UPDATE accounts SET current_balance = ? WHERE id = ?').run(777.77, 'acc-src');

    const txExpAfter = db.prepare('SELECT amount_cents FROM transactions WHERE id = ?').get('tx-exp') as { amount_cents: number };
    const tr1After = db
      .prepare('SELECT amount_cents, fees_cents FROM transfers WHERE id = ?')
      .get('tr-1') as { amount_cents: number; fees_cents: number };
    const accountAfter = db
      .prepare('SELECT current_balance_cents FROM accounts WHERE id = ?')
      .get('acc-src') as { current_balance_cents: number };

    expect(txExpAfter.amount_cents).toBe(1599);
    expect(tr1After.amount_cents).toBe(1234);
    expect(tr1After.fees_cents).toBe(50);
    expect(accountAfter.current_balance_cents).toBe(77777);

    db.close();
  });
});
