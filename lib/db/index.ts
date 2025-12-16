import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { getDatabaseDialectFromUrl } from './dialect';

let sqlite: Database.Database;
let pgPool: Pool | undefined;
let db: BetterSQLite3Database<typeof import('./schema.sqlite')> | NodePgDatabase<typeof import('./schema.pg')>;

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
  var pgPool: Pool | undefined;
  var db:
    | BetterSQLite3Database<typeof import('./schema.sqlite')>
    | NodePgDatabase<typeof import('./schema.pg')>
    | undefined;
}

const dialect = getDatabaseDialectFromUrl(process.env.DATABASE_URL);

if (dialect === 'postgresql') {
  // Postgres runtime (officially supported 17+ per Unraid plan)
  // Note: DATABASE_URL must be set to a postgres:// or postgresql:// URL.
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is required for Postgres mode.');

  if (process.env.NODE_ENV !== 'production') {
    if (!global.pgPool) global.pgPool = new Pool({ connectionString: url });
    if (!global.db) global.db = drizzlePg(global.pgPool, { schema: schema as unknown as typeof import('./schema.pg') });
    pgPool = global.pgPool;
    db = global.db;
  } else {
    pgPool = new Pool({ connectionString: url });
    db = drizzlePg(pgPool, { schema: schema as unknown as typeof import('./schema.pg') });
  }
} else {
  // SQLite runtime (default)
  if (process.env.NODE_ENV === 'production') {
    sqlite = new Database(sqlitePath);
    db = drizzle(sqlite, { schema: schema as unknown as typeof import('./schema.sqlite') });
  } else {
    if (!global.sqlite) global.sqlite = new Database(sqlitePath);
    if (!global.db) global.db = drizzle(global.sqlite, { schema: schema as unknown as typeof import('./schema.sqlite') });
    sqlite = global.sqlite;
    db = global.db;
  }
}

export { db, sqlite, pgPool };
