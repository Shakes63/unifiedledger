import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import * as schema from './schema';

export type DatabaseDialect = 'sqlite' | 'postgresql';

export function getDatabaseDialect(databaseUrl: string | undefined): DatabaseDialect {
  const v = databaseUrl?.trim().toLowerCase();
  if (v?.startsWith('postgres://') || v?.startsWith('postgresql://')) return 'postgresql';
  return 'sqlite';
}

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

function resolveSqlitePath() {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) {
    // Supports DATABASE_URL like:
    // - file:/config/finance.db
    // - file:///config/finance.db
    // - /config/finance.db
    if (envUrl.startsWith('file:')) {
      try {
        return new URL(envUrl).pathname;
      } catch {
        // Fallback: strip "file:" prefix and keep the remainder.
        return envUrl.replace(/^file:/, '');
      }
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

declare global {
  var sqlite: Database.Database | undefined;
  var db: ReturnType<typeof drizzle> | undefined;
}

// Postgres support is planned for Unraid CA, but schema + adapter conversion is not implemented yet.
// Fail fast rather than running with an incompatible driver/schema combination.
if (getDatabaseDialect(process.env.DATABASE_URL) === 'postgresql') {
  throw new Error(
    'Postgres DATABASE_URL detected, but Postgres runtime support is not implemented yet. ' +
      'Use SQLite (DATABASE_URL=file:/config/finance.db) for now.'
  );
}

if (process.env.NODE_ENV === 'production') {
  sqlite = new Database(sqlitePath);
  db = drizzle(sqlite, { schema });
} else {
  if (!global.sqlite) {
    global.sqlite = new Database(sqlitePath);
  }
  if (!global.db) {
    global.db = drizzle(global.sqlite, { schema });
  }
  sqlite = global.sqlite;
  db = global.db;
}

export { db, sqlite };
