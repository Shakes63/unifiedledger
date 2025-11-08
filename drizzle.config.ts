export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './sqlite.db',
  },
};
