import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './sqlite.db',
  },
} satisfies Config;
