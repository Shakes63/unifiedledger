const drizzleConfig = {
  schema: ['./lib/db/schema.ts', './auth-schema.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './sqlite.db',
  },
};

export default drizzleConfig;
