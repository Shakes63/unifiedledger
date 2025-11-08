import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

declare global {
  var sqlite: Database.Database | undefined;
  var db: ReturnType<typeof drizzle> | undefined;
}

if (process.env.NODE_ENV === 'production') {
  sqlite = new Database('./sqlite.db');
  db = drizzle(sqlite, { schema });
} else {
  if (!global.sqlite) {
    global.sqlite = new Database('./sqlite.db');
  }
  if (!global.db) {
    global.db = drizzle(global.sqlite, { schema });
  }
  sqlite = global.sqlite;
  db = global.db;
}

export { db, sqlite };
