import { join } from 'path';

import Database from 'better-sqlite3';
import { Pool } from 'pg';

function getDialect(databaseUrl) {
  const value = databaseUrl?.trim().toLowerCase();
  if (value?.startsWith('postgres://') || value?.startsWith('postgresql://')) {
    return 'postgresql';
  }
  return 'sqlite';
}

function resolveSqlitePath(databaseUrl) {
  const envUrl = databaseUrl?.trim();
  if (envUrl) {
    if (envUrl.startsWith('file:')) {
      const afterFilePrefix = envUrl.slice(5);
      if (afterFilePrefix.startsWith('./') || afterFilePrefix.startsWith('../')) {
        return join(process.cwd(), afterFilePrefix);
      }
      try {
        return new URL(envUrl).pathname;
      } catch {
        return afterFilePrefix;
      }
    }
    if (envUrl.startsWith('./') || envUrl.startsWith('../')) {
      return join(process.cwd(), envUrl);
    }
    return envUrl;
  }

  if (process.env.NODE_ENV === 'production') {
    return join('/config', 'finance.db');
  }
  return join(process.cwd(), 'sqlite.db');
}

const checks = [
  {
    name: 'accounts.current_balance_cents NULL',
    sql: 'SELECT COUNT(*) AS count FROM accounts WHERE current_balance_cents IS NULL',
  },
  {
    name: 'transactions.amount_cents NULL',
    sql: 'SELECT COUNT(*) AS count FROM transactions WHERE amount_cents IS NULL',
  },
  {
    name: 'transaction_splits.amount_cents NULL',
    sql: 'SELECT COUNT(*) AS count FROM transaction_splits WHERE amount_cents IS NULL',
  },
  {
    name: 'transfers.amount_cents NULL',
    sql: 'SELECT COUNT(*) AS count FROM transfers WHERE amount_cents IS NULL',
  },
  {
    name: 'transfers.fees_cents NULL',
    sql: 'SELECT COUNT(*) AS count FROM transfers WHERE fees_cents IS NULL',
  },
  {
    name: 'accounts decimal/cents drift',
    sql: 'SELECT COUNT(*) AS count FROM accounts WHERE ABS(COALESCE(current_balance, 0) - (current_balance_cents / 100.0)) > 0.000001',
  },
  {
    name: 'transactions decimal/cents drift',
    sql: 'SELECT COUNT(*) AS count FROM transactions WHERE ABS(amount - (amount_cents / 100.0)) > 0.000001',
  },
  {
    name: 'transaction_splits decimal/cents drift',
    sql: 'SELECT COUNT(*) AS count FROM transaction_splits WHERE ABS(amount - (amount_cents / 100.0)) > 0.000001',
  },
  {
    name: 'transfers.amount decimal/cents drift',
    sql: 'SELECT COUNT(*) AS count FROM transfers WHERE ABS(amount - (amount_cents / 100.0)) > 0.000001',
  },
  {
    name: 'transfers.fees decimal/cents drift',
    sql: 'SELECT COUNT(*) AS count FROM transfers WHERE ABS(COALESCE(fees, 0) - (fees_cents / 100.0)) > 0.000001',
  },
  {
    name: 'transfers missing/invalid from_transaction linkage',
    sql: `
      SELECT COUNT(*) AS count
      FROM transfers tr
      LEFT JOIN transactions tx_out
        ON tx_out.id = tr.from_transaction_id
       AND tx_out.user_id = tr.user_id
       AND tx_out.household_id = tr.household_id
      WHERE tr.from_transaction_id IS NOT NULL
        AND (
          tx_out.id IS NULL
          OR tx_out.type <> 'transfer_out'
          OR ABS(tx_out.amount_cents) <> (tr.amount_cents + tr.fees_cents)
        )
    `,
  },
  {
    name: 'transfers missing/invalid to_transaction linkage',
    sql: `
      SELECT COUNT(*) AS count
      FROM transfers tr
      LEFT JOIN transactions tx_in
        ON tx_in.id = tr.to_transaction_id
       AND tx_in.user_id = tr.user_id
       AND tx_in.household_id = tr.household_id
      WHERE tr.to_transaction_id IS NOT NULL
        AND (
          tx_in.id IS NULL
          OR tx_in.type <> 'transfer_in'
          OR tx_in.amount_cents <> tr.amount_cents
        )
    `,
  },
];

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  const dialect = getDialect(databaseUrl);
  let failures = 0;

  console.log(`[verify-money-integrity] dialect: ${dialect}`);

  if (dialect === 'postgresql') {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      for (const check of checks) {
        const result = await pool.query(check.sql);
        const count = Number(result.rows[0]?.count ?? 0);
        if (count > 0) {
          failures += 1;
          console.error(`[FAIL] ${check.name}: ${count}`);
        } else {
          console.log(`[OK] ${check.name}`);
        }
      }
    } finally {
      await pool.end();
    }
  } else {
    const dbPath = resolveSqlitePath(databaseUrl);
    console.log(`[verify-money-integrity] sqlite path: ${dbPath}`);
    const sqlite = new Database(dbPath, { fileMustExist: true });
    try {
      for (const check of checks) {
        const row = sqlite.prepare(check.sql).get();
        const count = Number(row?.count ?? 0);
        if (count > 0) {
          failures += 1;
          console.error(`[FAIL] ${check.name}: ${count}`);
        } else {
          console.log(`[OK] ${check.name}`);
        }
      }
    } finally {
      sqlite.close();
    }
  }

  if (failures > 0) {
    console.error(`[verify-money-integrity] failed checks: ${failures}`);
    process.exit(1);
  }

  console.log('[verify-money-integrity] all checks passed');
}

run().catch((error) => {
  console.error('[verify-money-integrity] error:', error);
  process.exit(1);
});
