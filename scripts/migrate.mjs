#!/usr/bin/env node
/**
 * Lightweight production migration script using drizzle-orm's migrate() function.
 * This avoids needing drizzle-kit at runtime, reducing the Docker image by ~150MB.
 * SQLite-only: the Postgres dialect was removed when the app standardized on SQLite.
 */
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { migrate as migrateSqlite } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
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

  if (isPostgresUrl(databaseUrl)) {
    console.error(
      '[migrate] DATABASE_URL is a Postgres URL, but Postgres support has been removed — ' +
        'this app is SQLite-only. Use a file: path (e.g. file:/config/finance.db).'
    );
    process.exit(1);
  }

  const migrationsFolder = path.resolve(__dirname, '..', 'drizzle', 'sqlite');

  console.log('[migrate] Running migrations for SQLite...');
  console.log(`[migrate] Migrations folder: ${migrationsFolder}`);

  try {
    // SQLite: extract file path from URL (file:/path/to/db.sqlite)
    const dbPath = databaseUrl.replace(/^file:/, '');
    const sqlite = new Database(dbPath);
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
