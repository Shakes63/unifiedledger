import { join } from 'path';

import Database from 'better-sqlite3';

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
    name: 'debts.remaining_balance_cents NULL',
    sql: 'SELECT COUNT(*) AS count FROM debts WHERE remaining_balance_cents IS NULL',
  },
  {
    name: 'debts.remaining_balance decimal/cents drift',
    sql: 'SELECT COUNT(*) AS count FROM debts WHERE ABS(remaining_balance - (remaining_balance_cents / 100.0)) > 0.000001',
  },
  {
    name: 'debt_payments decimal/cents drift',
    sql: `SELECT COUNT(*) AS count FROM debt_payments
          WHERE amount_cents IS NOT NULL
            AND (ABS(amount - (amount_cents / 100.0)) > 0.000001
                 OR ABS(COALESCE(principal_amount, 0) - (COALESCE(principal_cents, 0) / 100.0)) > 0.000001)`,
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

// The money-link foreign keys enforced by migration 0018. A table rebuild that
// forgets to re-declare one would silently drop enforcement, so assert each is
// still present (child table -> referenced parent) and that no row violates any
// FK. Actions are not asserted here — foreign_key_list ordering is stable enough
// for presence, and the rebuild test covers CASCADE/SET NULL behaviour.
const EXPECTED_SQLITE_FKS = {
  transaction_splits: ['transactions'],
  transaction_tags: ['transactions'],
  custom_field_values: ['transactions'],
  debt_payments: ['debts', 'transactions'],
  savings_goal_contributions: ['savings_goals'],
  bill_payment_events: ['bill_occurrences'],
  transfers: ['transactions', 'transactions'],
};

// The 12 money tables converted to STRICT by migration 0019. A future rebuild
// that forgets the STRICT keyword would silently reopen the type-flexibility
// hole (floats/text sneaking into INTEGER cents columns), so assert it stays.
const EXPECTED_STRICT_TABLES = [
  'accounts',
  'transactions',
  'debts',
  'savings_goals',
  'bill_occurrences',
  'transaction_splits',
  'transaction_tags',
  'custom_field_values',
  'debt_payments',
  'savings_goal_contributions',
  'bill_payment_events',
  'transfers',
];

function verifySqliteStrictTables(sqlite) {
  let failures = 0;
  for (const table of EXPECTED_STRICT_TABLES) {
    const row = sqlite
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?")
      .get(table);
    // Anchored: LIKE '%STRICT%' would false-positive on column names such as
    // special_district_rate ("diSTRICT").
    const isStrict = row && /\)\s*STRICT\s*;?\s*$/i.test(row.sql);
    if (!isStrict) {
      failures += 1;
      console.error(`[FAIL] ${table} is not a STRICT table`);
    } else {
      console.log(`[OK] ${table} is STRICT`);
    }
  }
  return failures;
}

/**
 * NON-FATAL: a negative balance on a credit / line_of_credit account is the
 * signature of the pre-audit asset-sign engine (C-MATH-1) — under the current
 * positive-owed convention it is only legitimate when the card is genuinely
 * overpaid. Warn (do not fail) and point at the one-time reconciliation tool.
 */
function warnAboutLegacyCreditSigns(sqlite) {
  const rows = sqlite
    .prepare(
      `SELECT id, name, current_balance_cents AS cents
       FROM accounts
       WHERE type IN ('credit', 'line_of_credit') AND current_balance_cents < 0`
    )
    .all();
  if (rows.length === 0) return;
  for (const row of rows) {
    console.warn(
      `[WARN] liability account "${row.name}" stores a NEGATIVE owed balance ` +
        `(${(row.cents / 100).toFixed(2)}) — legitimate only if truly overpaid. ` +
        `If this predates the sign fix, reconcile it once: ` +
        `pnpm db:reconcile:credit -- --fix-account ${row.id} --owed <statement dollars>`
    );
  }
}

function verifySqliteForeignKeys(sqlite) {
  let failures = 0;

  // 1) No existing row may violate a declared foreign key.
  const violations = sqlite.prepare('PRAGMA foreign_key_check').all();
  if (violations.length > 0) {
    failures += 1;
    const summary = violations
      .map((v) => `${v.table}#${v.rowid}->${v.parent}`)
      .slice(0, 10)
      .join(', ');
    console.error(`[FAIL] foreign_key_check: ${violations.length} violation(s): ${summary}`);
  } else {
    console.log('[OK] foreign_key_check (no violations)');
  }

  // 2) Every expected money-link FK is still declared.
  for (const [table, expectedParents] of Object.entries(EXPECTED_SQLITE_FKS)) {
    const parents = sqlite
      .prepare(`PRAGMA foreign_key_list(${table})`)
      .all()
      .map((fk) => fk.table)
      .sort();
    const want = [...expectedParents].sort();
    const ok = want.length === parents.length && want.every((p, i) => p === parents[i]);
    if (!ok) {
      failures += 1;
      console.error(
        `[FAIL] ${table} foreign keys: expected -> [${want.join(', ')}], found -> [${parents.join(', ')}]`
      );
    } else {
      console.log(`[OK] ${table} foreign keys (-> ${parents.join(', ')})`);
    }
  }

  return failures;
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  let failures = 0;

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
    failures += verifySqliteForeignKeys(sqlite);
    failures += verifySqliteStrictTables(sqlite);
    warnAboutLegacyCreditSigns(sqlite);
  } finally {
    sqlite.close();
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
