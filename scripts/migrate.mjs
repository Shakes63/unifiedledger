#!/usr/bin/env node
/**
 * Lightweight production migration script using drizzle-orm's migrate() function.
 * This avoids needing drizzle-kit at runtime, reducing the Docker image by ~150MB.
 */
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migrateSqlite } from 'drizzle-orm/better-sqlite3/migrator';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isPostgresUrl(databaseUrl) {
  const v = (databaseUrl ?? '').trim().toLowerCase();
  return v.startsWith('postgres://') || v.startsWith('postgresql://');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    console.error('[migrate] DATABASE_URL is required');
    process.exit(1);
  }

  const isPostgres = isPostgresUrl(databaseUrl);
  const migrationsFolder = path.resolve(__dirname, '..', 'drizzle', isPostgres ? 'postgres' : 'sqlite');

  console.log(`[migrate] Running migrations for ${isPostgres ? 'PostgreSQL' : 'SQLite'}...`);
  console.log(`[migrate] Migrations folder: ${migrationsFolder}`);

  try {
    if (isPostgres) {
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      const db = drizzlePg(client);
      await migratePg(db, { migrationsFolder });
      await client.end();
    } else {
      // SQLite: extract file path from URL (file:/path/to/db.sqlite)
      const dbPath = databaseUrl.replace(/^file:/, '');
      const sqlite = new Database(dbPath);
      const db = drizzleSqlite(sqlite);
      migrateSqlite(db, { migrationsFolder });
      sqlite.close();
    }
    console.log('[migrate] Migrations completed successfully');
  } catch (error) {
    console.error('[migrate] Migration failed:', error);
    process.exit(1);
  }
}

main();
