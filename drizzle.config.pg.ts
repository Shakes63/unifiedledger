const drizzleConfig = {
  // NOTE: Postgres support is implemented incrementally.
  // Once `lib/db/schema.pg.ts` exists, switch this schema list to it.
  schema: ["./lib/db/schema.ts", "./auth-schema.ts"],
  out: "./drizzle/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL?.trim() ?? "",
  },
} as const;

export default drizzleConfig;


