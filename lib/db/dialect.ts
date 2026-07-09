/**
 * This app is SQLite-only. This helper survives solely so the DB entry point can
 * DETECT a leftover Postgres connection string and fail loudly instead of
 * silently booting against an empty SQLite file (see lib/db/index.ts).
 */
export type DatabaseDialect = "sqlite" | "postgresql";

export function getDatabaseDialectFromUrl(databaseUrl: string | undefined): DatabaseDialect {
  const v = databaseUrl?.trim().toLowerCase();
  if (v?.startsWith("postgres://") || v?.startsWith("postgresql://")) return "postgresql";
  return "sqlite";
}
