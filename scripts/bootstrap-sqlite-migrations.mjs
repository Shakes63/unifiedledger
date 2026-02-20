#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

function resolveSqlitePath(databaseUrlRaw) {
  const databaseUrl = databaseUrlRaw?.trim();
  if (databaseUrl) {
    if (databaseUrl.startsWith('file:')) {
      const afterFilePrefix = databaseUrl.slice(5);
      if (afterFilePrefix.startsWith('./') || afterFilePrefix.startsWith('../')) {
        return path.resolve(process.cwd(), afterFilePrefix);
      }
      try {
        return new URL(databaseUrl).pathname;
      } catch {
        return path.resolve(process.cwd(), afterFilePrefix);
      }
    }

    if (databaseUrl.startsWith('./') || databaseUrl.startsWith('../')) {
      return path.resolve(process.cwd(), databaseUrl);
    }

    return databaseUrl;
  }

  if (process.env.NODE_ENV === 'production') {
    return path.join('/config', 'finance.db');
  }
  return path.join(process.cwd(), 'sqlite.db');
}

function loadJournalEntries(repoRoot) {
  const journalPath = path.join(repoRoot, 'drizzle', 'sqlite', 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  if (!Array.isArray(journal.entries)) {
    throw new Error(`Invalid journal format at ${journalPath}`);
  }
  return journal.entries;
}

function computeMigrationHash(sqlPath) {
  const sqlContents = fs.readFileSync(sqlPath, 'utf8');
  return crypto.createHash('sha256').update(sqlContents).digest('hex');
}

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      "id" SERIAL PRIMARY KEY,
      "hash" TEXT NOT NULL,
      "created_at" numeric
    );
  `);
}

function tableExists(db, tableName) {
  return !!db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
    .get(tableName);
}

function columnExists(db, tableName, columnName) {
  return !!db
    .prepare(`SELECT 1 FROM pragma_table_info('${tableName}') WHERE name = ? LIMIT 1`)
    .get(columnName);
}

function triggerSql(db, triggerName) {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ? LIMIT 1`)
    .get(triggerName);
  return typeof row?.sql === 'string' ? row.sql : null;
}

function migrationLooksApplied(db, tag) {
  // Conservative, repo-specific detectors.
  // Unknown tags return false so migrate can apply them normally.
  switch (tag) {
    case '0000_stale_bill_hollister':
      return (
        tableExists(db, 'accounts') &&
        tableExists(db, 'transactions') &&
        tableExists(db, 'households') &&
        tableExists(db, 'household_members')
      );
    case '0001_add_include_in_discretionary':
      return columnExists(db, 'accounts', 'include_in_discretionary');
    case '0002_add_bill_split_payments':
      return (
        columnExists(db, 'bill_instances', 'payment_status') &&
        columnExists(db, 'bill_payments', 'principal_amount') &&
        tableExists(db, 'bill_instance_allocations')
      );
    case '0003_clear_avatar_data_urls':
      return tableExists(db, 'user');
    case '0004_add_transfers_household_scope':
      return columnExists(db, 'transfers', 'household_id');
    case '0005_add_transaction_transfer_account_links':
      return (
        columnExists(db, 'transactions', 'transfer_source_account_id') &&
        columnExists(db, 'transactions', 'transfer_destination_account_id')
      );
    case '0006_add_money_cents_columns':
      return (
        columnExists(db, 'accounts', 'current_balance_cents') &&
        columnExists(db, 'transactions', 'amount_cents') &&
        columnExists(db, 'transfers', 'amount_cents') &&
        columnExists(db, 'transaction_splits', 'amount_cents')
      );
    case '0007_enforce_money_cents_non_null': {
      const txTriggerSql = triggerSql(db, 'trg_transactions_sync_amount_cents_insert');
      const transferTriggerSql = triggerSql(db, 'trg_transfers_sync_amount_cents_insert');
      return (
        typeof txTriggerSql === 'string' &&
        typeof transferTriggerSql === 'string' &&
        txTriggerSql.includes('COALESCE(NEW.amount, 0)') &&
        transferTriggerSql.includes('COALESCE(NEW.fees, 0)')
      );
    }
    case '0008_add_money_cents_integrity_guards':
      return (
        !!triggerSql(db, 'trg_transactions_money_cents_guard_insert') &&
        !!triggerSql(db, 'trg_transactions_money_cents_guard_update') &&
        !!triggerSql(db, 'trg_transfers_money_cents_guard_insert') &&
        !!triggerSql(db, 'trg_transfers_money_cents_guard_update')
      );
    default:
      return false;
  }
}

function bootstrap() {
  const repoRoot = process.cwd();
  const dbPath = resolveSqlitePath(process.env.DATABASE_URL);
  const entries = loadJournalEntries(repoRoot);

  const db = new Database(dbPath);
  ensureMigrationsTable(db);

  const existingHashes = new Set(
    db.prepare('SELECT hash FROM "__drizzle_migrations"').all().map((row) => row.hash)
  );

  let inserted = 0;
  let skipped = 0;
  let pending = 0;

  const insertStmt = db.prepare(
    'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)'
  );

  for (const entry of entries) {
    const sqlPath = path.join(repoRoot, 'drizzle', 'sqlite', `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Missing migration file for journal entry: ${entry.tag}`);
    }

    const hash = computeMigrationHash(sqlPath);
    if (existingHashes.has(hash)) {
      skipped += 1;
      continue;
    }

    if (!migrationLooksApplied(db, entry.tag)) {
      pending += 1;
      continue;
    }

    insertStmt.run(hash, entry.when);
    existingHashes.add(hash);
    inserted += 1;
  }

  db.close();

  console.log(`[bootstrap-sqlite-migrations] database: ${dbPath}`);
  console.log(`[bootstrap-sqlite-migrations] entries in journal: ${entries.length}`);
  console.log(
    `[bootstrap-sqlite-migrations] inserted: ${inserted}, skipped(existing): ${skipped}, pending(unapplied): ${pending}`
  );
}

try {
  bootstrap();
} catch (error) {
  console.error('[bootstrap-sqlite-migrations] failed:', error);
  process.exit(1);
}
