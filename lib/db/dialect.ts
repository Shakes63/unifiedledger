export type DatabaseDialect = "sqlite" | "postgresql";

export function getDatabaseDialectFromUrl(databaseUrl: string | undefined): DatabaseDialect {
  const v = databaseUrl?.trim().toLowerCase();
  if (v?.startsWith("postgres://") || v?.startsWith("postgresql://")) return "postgresql";
  return "sqlite";
}

export function getCurrentDatabaseDialect(): DatabaseDialect {
  return getDatabaseDialectFromUrl(process.env.DATABASE_URL);
}


