#!/usr/bin/env node
/**
 * Lightweight production migration script using drizzle-orm's migrate() function.
 * This avoids needing drizzle-kit at runtime, reducing the Docker image by ~150MB.
 * SQLite-only: the Postgres dialect was removed when the app standardized on SQLite.
 *
 * Before applying PENDING migrations to an existing database, a consistent
 * pre-migration snapshot is taken with VACUUM INTO (production hardening
 * item 3) — table-rebuild migrations like 0018/0019 rewrite whole tables, and
 * the snapshot makes every deploy trivially reversible:
 *   stop container -> copy backups/pre-migration/<file> over finance.db -> start old image
 * The last PRE_MIGRATION_RETAIN snapshots are kept.
 */
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { migrate as migrateSqlite } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRE_MIGRATION_RETAIN = 3;

function isPostgresUrl(databaseUrl) {
  const v = (databaseUrl ?? '').trim().toLowerCase();
  return v.startsWith('postgres://') || v.startsWith('postgresql://');
}

function countJournalEntries(migrationsFolder) {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  return (journal.entries ?? []).length;
}

function countAppliedMigrations(sqlite) {
  try {
    const row = sqlite.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get();
    return Number(row?.n ?? 0);
  } catch {
    // Table doesn't exist yet -> brand-new database, nothing applied.
    return 0;
  }
}

/**
 * VACUUM INTO a timestamped copy of the DB before pending migrations touch it.
 * Only fires when the database already has applied migrations (a brand-new
 * empty file has nothing worth snapshotting). Failures ABORT the migration:
 * proceeding without the safety copy defeats the point.
 */
function snapshotBeforeMigration(sqlite, dbPath, { pending, applied }) {
  if (pending <= 0 || applied === 0) return null;

  const dir = path.join(path.dirname(dbPath), 'backups', 'pre-migration');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = path.join(dir, `pre-migration-${stamp}.db`);
  sqlite.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);

  // Prune old snapshots beyond the retention count.
  const stale = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith('pre-migration-') && name.endsWith('.db'))
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    .slice(PRE_MIGRATION_RETAIN);
  for (const file of stale) {
    try {
      fs.unlinkSync(file);
    } catch {
      // best-effort prune
    }
  }

  return snapshotPath;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    console.error('[migrate] DATABASE_URL is required');
    process.exit(1);
  }

  if (isPostgresUrl(databaseUrl)) {
    console.error(
      '[migrate] DATABASE_URL is a Postgres URL, but Postgres support has been removed — ' +
        'this app is SQLite-only. Use a file: path (e.g. file:/config/finance.db).'
    );
    process.exit(1);
  }

  // MIGRATIONS_FOLDER override exists for tests (fixture migration trees).
  const migrationsFolder =
    process.env.MIGRATIONS_FOLDER?.trim() || path.resolve(__dirname, '..', 'drizzle', 'sqlite');

  console.log('[migrate] Running migrations for SQLite...');
  console.log(`[migrate] Migrations folder: ${migrationsFolder}`);

  try {
    // SQLite: extract file path from URL (file:/path/to/db.sqlite)
    const dbPath = databaseUrl.replace(/^file:/, '');
    const sqlite = new Database(dbPath);

    const total = countJournalEntries(migrationsFolder);
    const applied = countAppliedMigrations(sqlite);
    const pending = total - applied;
    console.log(`[migrate] Journal: ${total} migrations, applied: ${applied}, pending: ${Math.max(0, pending)}`);

    const snapshotPath = snapshotBeforeMigration(sqlite, dbPath, { pending, applied });
    if (snapshotPath) {
      console.log(`[migrate] Pre-migration snapshot: ${snapshotPath}`);
    }

    const db = drizzleSqlite(sqlite);
    migrateSqlite(db, { migrationsFolder });
    sqlite.close();
    console.log('[migrate] Migrations completed successfully');
  } catch (error) {
    console.error('[migrate] Migration failed:', error);
    process.exit(1);
  }
}

main();
