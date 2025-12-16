const drizzleConfig = {
  // NOTE: Postgres support is implemented incrementally.
  schema: ["./lib/db/schema.pg.ts", "./auth-schema.pg.ts"],
  out: "./drizzle/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: (() => {
      const url = process.env.DATABASE_URL?.trim();
      if (!url) {
        // Allow generation workflows to run locally by providing a safe placeholder.
        // For runtime migrations, the container must set DATABASE_URL.
        return "postgresql://postgres:postgres@localhost:5432/unifiedledger";
      }
      return url;
    })(),
  },
} as const;

export default drizzleConfig;


