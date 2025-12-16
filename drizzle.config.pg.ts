const drizzleConfig = {
  // NOTE: Postgres support is implemented incrementally.
  // Once `lib/db/schema.pg.ts` exists, switch this schema list to it.
  schema: ["./lib/db/schema.ts", "./auth-schema.ts"],
  out: "./drizzle/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: (() => {
      const url = process.env.DATABASE_URL?.trim();
      if (!url) {
        throw new Error(
          "DATABASE_URL is required for Postgres migrations. Example: postgresql://USER:PASSWORD@HOST:5432/unifiedledger"
        );
      }
      return url;
    })(),
  },
} as const;

export default drizzleConfig;


