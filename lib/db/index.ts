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
    sqlite = new Database(sqlitePath);
    db = drizzle(sqlite, { schema });
  } else {
    if (!global.sqlite) global.sqlite = new Database(sqlitePath);
    if (!global.db) global.db = drizzle(global.sqlite, { schema });
    sqlite = global.sqlite;
    db = global.db;
  }
}

export { db, sqlite, pgPool };
