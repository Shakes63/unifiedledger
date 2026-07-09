#!/usr/bin/env node
/**
 * One-time reconciliation/repair for credit & line-of-credit balances written
 * by the pre-audit asset-sign engine (C-MATH-1 follow-up, see commit 91261b9).
 *
 * The old engine applied the ASSET rule to every account, so a credit-card
 * charge DECREASED the stored balance and the UI mislabelled real debt as an
 * "overpayment". The new engine is liability-aware (positive balance = amount
 * OWED), but balances accumulated under the old rule were never rewritten —
 * they may still carry a legacy offset.
 *
 * A per-transaction repair is impossible after the fact (there is no record of
 * which engine applied each row), so this tool reconciles at the ACCOUNT level:
 *
 *   REPORT (default, read-only)
 *     For every credit / line_of_credit account, replays the account's full
 *     transaction history under the liability convention and prints:
 *       stored owed, ledger-derived delta, implied opening balance, and flags.
 *     A NEGATIVE implied opening or negative stored owed is the classic
 *     legacy-sign signature (unless the card is genuinely overpaid).
 *
 *   FIX (explicit, per account, backup first)
 *     --fix-account <id> --owed <dollars>
 *         Sets the balance to the true amount owed — read it from the card's
 *         real statement; that is the ground truth this app cannot derive.
 *     --fix-account <id> --from-ledger [--opening <dollars>]
 *         Sets balance = opening (default 0) + ledger-derived delta. Correct
 *         when the account's ENTIRE history lives in this app.
 *
 *     Every fix: copies the DB file to <db>.bak-credit-fix-<timestamp> first,
 *     then updates current_balance AND current_balance_cents together in one
 *     statement (the money-cents guard trigger enforces their consistency)
 *     inside a transaction, and prints before/after.
 *
 * Sign conventions replayed here mirror lib/transactions/money-movement-fields
 * computeBalanceDeltaCents exactly: on a liability, expense/transfer_out
 * INCREASE owed; income/transfer_in DECREASE it. Legacy rows stored expense
 * amounts as negative cents (direction was double-encoded), so amounts are
 * normalized with abs() — the row's type carries the direction.
 */
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

const LIABILITY_TYPES = new Set(['credit', 'line_of_credit']);
const DEBIT_TYPES = new Set(['expense', 'transfer_out']);
const CREDIT_TYPES = new Set(['income', 'transfer_in']);

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

function centsToDollars(cents) {
  return (cents / 100).toFixed(2);
}

function parseDollarsToCents(raw, label) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`[reconcile-credit] ${label} must be a finite dollar amount, got "${raw}"`);
    process.exit(1);
  }
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents)) {
    console.error(`[reconcile-credit] ${label} is out of range: "${raw}"`);
    process.exit(1);
  }
  return cents;
}

/**
 * Replays an account's history under the liability convention (the semantics
 * of computeBalanceDeltaCents for liability accounts): charges
 * (expense/transfer_out) increase owed, payments/refunds (income/transfer_in)
 * decrease it. Amounts are normalized with abs() because legacy rows
 * double-encoded direction in the amount's sign; the row's type carries it.
 */
function deriveLedgerDelta(db, accountId) {
  const rows = db
    .prepare(
      `SELECT type, amount_cents AS amountCents, count(*) AS n, sum(abs(amount_cents)) AS totalAbs
       FROM transactions WHERE account_id = ? GROUP BY type`
    )
    .all(accountId);

  let delta = 0;
  const breakdown = [];
  for (const row of rows) {
    const rowDelta = DEBIT_TYPES.has(row.type)
      ? row.totalAbs
      : CREDIT_TYPES.has(row.type)
        ? -row.totalAbs
        : 0;
    delta += rowDelta;
    breakdown.push(`${row.type}: ${row.n} rows, ${rowDelta >= 0 ? '+' : ''}${centsToDollars(rowDelta)}`);
  }
  return { delta, breakdown };
}

function report(db) {
  const accounts = db
    .prepare(
      `SELECT id, name, type, current_balance_cents AS storedCents
       FROM accounts WHERE type IN ('credit', 'line_of_credit') ORDER BY name`
    )
    .all();

  if (accounts.length === 0) {
    console.log('[reconcile-credit] no credit / line_of_credit accounts found — nothing to reconcile.');
    return;
  }

  console.log(`[reconcile-credit] ${accounts.length} liability account(s):\n`);
  let flagged = 0;
  for (const account of accounts) {
    const { delta, breakdown } = deriveLedgerDelta(db, account.id);
    const impliedOpening = account.storedCents - delta;

    const flags = [];
    if (account.storedCents < 0) {
      flags.push('stored owed is NEGATIVE (legit only if the card is truly overpaid — legacy-sign suspect)');
    }
    if (impliedOpening < 0) {
      flags.push('implied opening is NEGATIVE (history cannot start below zero owed — legacy-sign suspect)');
    }
    if (flags.length > 0) flagged += 1;

    console.log(`— ${account.name} (${account.type}) [${account.id}]`);
    console.log(`    stored owed:          $${centsToDollars(account.storedCents)}`);
    console.log(`    ledger delta (new convention): ${delta >= 0 ? '+' : ''}$${centsToDollars(delta)}`);
    for (const line of breakdown) console.log(`        ${line}`);
    console.log(`    implied opening owed: $${centsToDollars(impliedOpening)}`);
    if (flags.length > 0) {
      for (const flag of flags) console.log(`    ⚠️  ${flag}`);
      console.log(
        `    fix with the REAL statement balance:  pnpm db:reconcile:credit -- --fix-account ${account.id} --owed <dollars>`
      );
      console.log(
        `    or, if ALL history is in this app:    pnpm db:reconcile:credit -- --fix-account ${account.id} --from-ledger`
      );
    } else {
      console.log('    ✅ no legacy-sign signature detected');
    }
    console.log('');
  }

  console.log(
    flagged === 0
      ? '[reconcile-credit] all liability balances look consistent with the new convention.'
      : `[reconcile-credit] ${flagged} account(s) flagged — review above. Report mode made NO changes.`
  );
}

function applyFix(db, dbPath, { accountId, owedCents, fromLedger, openingCents }) {
  const account = db
    .prepare(
      `SELECT id, name, type, current_balance AS storedBalance, current_balance_cents AS storedCents
       FROM accounts WHERE id = ?`
    )
    .get(accountId);

  if (!account) {
    console.error(`[reconcile-credit] account not found: ${accountId}`);
    process.exit(1);
  }
  if (!LIABILITY_TYPES.has(account.type)) {
    console.error(
      `[reconcile-credit] ${account.name} is type "${account.type}" — this tool only corrects credit / line_of_credit accounts.`
    );
    process.exit(1);
  }

  let targetCents;
  if (fromLedger) {
    const { delta } = deriveLedgerDelta(db, accountId);
    targetCents = (openingCents ?? 0) + delta;
    console.log(
      `[reconcile-credit] from-ledger: opening $${centsToDollars(openingCents ?? 0)} + delta $${centsToDollars(delta)} = $${centsToDollars(targetCents)}`
    );
  } else {
    targetCents = owedCents;
  }

  if (targetCents === account.storedCents) {
    console.log(
      `[reconcile-credit] ${account.name} already stores $${centsToDollars(targetCents)} — nothing to do.`
    );
    return;
  }

  const backupPath = `${dbPath}.bak-credit-fix-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  copyFileSync(dbPath, backupPath);
  console.log(`[reconcile-credit] backup written: ${backupPath}`);

  const nowIso = new Date().toISOString();
  const run = db.transaction(() => {
    db.prepare(
      `UPDATE accounts
       SET current_balance = ?, current_balance_cents = ?, updated_at = ?
       WHERE id = ?`
    ).run(targetCents / 100, targetCents, nowIso, accountId);
  });
  run();

  const after = db
    .prepare('SELECT current_balance_cents AS cents FROM accounts WHERE id = ?')
    .get(accountId);
  console.log(
    `[reconcile-credit] ${account.name}: $${centsToDollars(account.storedCents)} -> $${centsToDollars(after.cents)} (owed, positive-owed convention)`
  );
}

function main() {
  const args = process.argv.slice(2);
  const getFlag = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : (args[i + 1] ?? '');
  };
  const hasFlag = (name) => args.includes(name);

  const dbPath = resolveSqlitePath(process.env.DATABASE_URL);
  console.log(`[reconcile-credit] sqlite path: ${dbPath}`);
  const db = new Database(dbPath, { fileMustExist: true });
  db.pragma('foreign_keys = ON');

  try {
    const fixAccount = getFlag('--fix-account');
    if (!fixAccount) {
      report(db);
      return;
    }

    const fromLedger = hasFlag('--from-ledger');
    const owedRaw = getFlag('--owed');
    const openingRaw = getFlag('--opening');

    if (!fromLedger && owedRaw === undefined) {
      console.error(
        '[reconcile-credit] --fix-account needs either --owed <dollars> (true statement balance) or --from-ledger [--opening <dollars>].'
      );
      process.exit(1);
    }

    applyFix(db, dbPath, {
      accountId: fixAccount,
      owedCents: owedRaw !== undefined ? parseDollarsToCents(owedRaw, '--owed') : undefined,
      fromLedger,
      openingCents: openingRaw !== undefined ? parseDollarsToCents(openingRaw, '--opening') : undefined,
    });
  } finally {
    db.close();
  }
}

main();
