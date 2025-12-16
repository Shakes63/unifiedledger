import path from "path";

function resolveSqliteFilePathFromDatabaseUrl(databaseUrl: string): string {
  const trimmed = databaseUrl.trim();
  if (trimmed.startsWith("file:")) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return trimmed.replace(/^file:/, "");
    }
  }
  return trimmed;
}

const drizzleConfig = {
  schema: ["./lib/db/schema.sqlite.ts", "./auth-schema.ts"],
  out: "./drizzle/sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: (() => {
      const envUrl = process.env.DATABASE_URL?.trim();
      if (envUrl) return resolveSqliteFilePathFromDatabaseUrl(envUrl);

      // Unraid CA contract default for production images.
      if (process.env.NODE_ENV === "production") {
        return path.join("/config", "finance.db");
      }

      // Local dev fallback.
      return path.join(process.cwd(), "sqlite.db");
    })(),
  },
} as const;

export default drizzleConfig;


