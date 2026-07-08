import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { getDatabaseDialectFromUrl } from './dialect';

let sqlite: Database.Database;
let pgPool: Pool | undefined;
// Use BetterSQLite3Database as the base type since it's the default and most common
// The actual runtime type depends on DATABASE_URL but TypeScript only needs one type for compilation
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

const sqlitePath = resolveSqlitePath();

/**
 * Guard against a malformed Postgres URL silently falling through to a brand-new
 * SQLite file (audit finding M-DB-5): e.g. a `postgress://` typo or a bare host
 * would otherwise be treated as a SQLite path and boot against an empty DB.
 */
function assertDatabaseUrlIsWellFormed(): void {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return;
  const lower = raw.toLowerCase();
  const looksPostgresLike =
    lower.includes('postgres') || lower.includes('@') || lower.includes('5432');
  const isValidPostgres = lower.startsWith('postgres://') || lower.startsWith('postgresql://');
  const isSqliteLike = lower.startsWith('file:') || lower.startsWith('./') ||
    lower.startsWith('../') || lower.startsWith('/') || lower.endsWith('.db');
  if (looksPostgresLike && !isValidPostgres && !isSqliteLike) {
    throw new Error(
      `DATABASE_URL="${raw}" looks like a Postgres connection string but is not a ` +
        `valid postgres:// / postgresql:// URL. Refusing to fall back to SQLite. ` +
        `Fix the URL or use an explicit file: path.`
    );
  }
}

assertDatabaseUrlIsWellFormed();

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
  var pgPool: Pool | undefined;
  // Use BetterSQLite3Database as the base type for global declaration
  var db: BetterSQLite3Database<typeof schema> | undefined;
}

const dialect = getDatabaseDialectFromUrl(process.env.DATABASE_URL);

if (dialect === 'postgresql') {
  // Postgres runtime (officially supported 17+ per Unraid plan)
  // Note: DATABASE_URL must be set to a postgres:// or postgresql:// URL.
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is required for Postgres mode.');

  if (process.env.NODE_ENV !== 'production') {
    if (!global.pgPool) global.pgPool = new Pool({ connectionString: url });
    if (!global.db) global.db = drizzlePg(global.pgPool, { schema }) as unknown as BetterSQLite3Database<typeof schema>;
    pgPool = global.pgPool;
    db = global.db;
  } else {
    pgPool = new Pool({ connectionString: url });
    db = drizzlePg(pgPool, { schema }) as unknown as BetterSQLite3Database<typeof schema>;
  }
} else {
  // SQLite runtime (default)
  if (process.env.NODE_ENV === 'production') {
    sqlite = configureSqliteConnection(new Database(sqlitePath));
    db = drizzle(sqlite, { schema });
  } else {
    if (!global.sqlite) global.sqlite = configureSqliteConnection(new Database(sqlitePath));
    if (!global.db) global.db = drizzle(global.sqlite, { schema });
    sqlite = global.sqlite;
    db = global.db;
  }
}

export { db, sqlite, pgPool };
