import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { getDatabaseDialectFromUrl } from './dialect';

let sqlite: Database.Database;
let db: BetterSQLite3Database<typeof schema>;

function resolveSqlitePath() {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) {
    // Supports DATABASE_URL like:
    // - file:/config/finance.db
    // - file:///config/finance.db
    // - file:./sqlite.db (relative path)
    // - /config/finance.db
    if (envUrl.startsWith('file:')) {
      // Strip the "file:" prefix first
      const afterFilePrefix = envUrl.slice(5); // Remove 'file:'

      // Check if it's a relative path BEFORE URL parsing mangles it
      // (new URL('file:./sqlite.db').pathname returns '/sqlite.db', losing the './')
      if (afterFilePrefix.startsWith('./') || afterFilePrefix.startsWith('../')) {
        return join(process.cwd(), afterFilePrefix);
      }

      // For absolute file: URLs, use URL parsing
      try {
        const path = new URL(envUrl).pathname;
        return path;
      } catch {
        // Fallback: return the path after file:
        return afterFilePrefix;
      }
    }
    // For non-file: URLs, check if it's a relative path
    if (envUrl.startsWith('./') || envUrl.startsWith('../')) {
      return join(process.cwd(), envUrl);
    }
    return envUrl;
  }

  // Default behavior:
  // - In production containers (Unraid CA), persist under /config
  // - In local dev, preserve existing ./sqlite.db behavior
  if (process.env.NODE_ENV === 'production') {
    return join('/config', 'finance.db');
  }
  return join(process.cwd(), 'sqlite.db');
}

/**
 * This app standardized on SQLite; the Postgres dialect was removed. Fail loudly
 * if a Postgres connection string is still configured rather than silently
 * booting against an empty SQLite file.
 */
function assertSqliteDatabaseUrl(): void {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return;

  if (getDatabaseDialectFromUrl(raw) === 'postgresql') {
    throw new Error(
      `DATABASE_URL="${raw}" is a Postgres URL, but Postgres support has been ` +
        `removed — this app is SQLite-only. Set DATABASE_URL to a file: path ` +
        `(e.g. file:/config/finance.db) or unset it to use the default.`
    );
  }

  // Guard against a malformed URL silently falling through to a brand-new SQLite
  // file (audit finding M-DB-5): e.g. a `postgress://` typo or a bare host would
  // otherwise be treated as a SQLite path and boot against an empty DB.
  const lower = raw.toLowerCase();
  const looksPostgresLike =
    lower.includes('postgres') || lower.includes('@') || lower.includes('5432');
  const isSqliteLike =
    lower.startsWith('file:') ||
    lower.startsWith('./') ||
    lower.startsWith('../') ||
    lower.startsWith('/') ||
    lower.endsWith('.db');
  if (looksPostgresLike && !isSqliteLike) {
    throw new Error(
      `DATABASE_URL="${raw}" looks like a database server URL but is not a valid ` +
        `SQLite file: path. Refusing to fall back to an empty SQLite file. ` +
        `Use an explicit file: path.`
    );
  }
}

assertSqliteDatabaseUrl();

const sqlitePath = resolveSqlitePath();

/**
 * Apply connection pragmas for a self-hosted single-connection SQLite deployment:
 * WAL so readers don't block the writer, a busy timeout so brief contention
 * retries instead of erroring, and enforced foreign keys (audit finding M-DB-4).
 */
function configureSqliteConnection(connection: Database.Database): Database.Database {
  connection.pragma('journal_mode = WAL');
  connection.pragma('busy_timeout = 5000');
  connection.pragma('foreign_keys = ON');
  connection.pragma('synchronous = NORMAL');
  return connection;
}

declare global {
  var sqlite: Database.Database | undefined;
  var db: BetterSQLite3Database<typeof schema> | undefined;
}

if (process.env.NODE_ENV === 'production') {
  sqlite = configureSqliteConnection(new Database(sqlitePath));
  db = drizzle(sqlite, { schema });
} else {
  if (!global.sqlite) global.sqlite = configureSqliteConnection(new Database(sqlitePath));
  if (!global.db) global.db = drizzle(global.sqlite, { schema });
  sqlite = global.sqlite;
  db = global.db;
}

export { db, sqlite };
