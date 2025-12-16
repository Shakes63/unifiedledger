import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import * as schema from './schema';

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

function resolveSqlitePath() {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) {
    // Supports DATABASE_URL like:
    // - file:/app/data/finance.db
    // - file:///app/data/finance.db
    // - /app/data/finance.db
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
  // - In Docker we mount /app/data and want the DB there
  // - In local dev, preserve existing ./sqlite.db behavior
  if (process.env.NODE_ENV === 'production') {
    return join(process.cwd(), 'data', 'finance.db');
  }
  return join(process.cwd(), 'sqlite.db');
}

const sqlitePath = resolveSqlitePath();

declare global {
  var sqlite: Database.Database | undefined;
  var db: ReturnType<typeof drizzle> | undefined;
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
