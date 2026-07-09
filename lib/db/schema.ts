/**
 * Database Schema Exports
 *
 * This app is SQLite-only (better-sqlite3). The former dual SQLite/Postgres
 * facade was removed when the project standardized on SQLite; this file now
 * simply re-exports the SQLite schema so existing `@/lib/db/schema` imports keep
 * working unchanged.
 */
export * from "./schema.sqlite";
