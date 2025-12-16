const drizzleConfig = {
  schema: ['./lib/db/schema.ts', './auth-schema.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: (() => {
      const envUrl = process.env.DATABASE_URL?.trim();
      if (envUrl) {
        if (envUrl.startsWith('file:')) {
          try {
            return new URL(envUrl).pathname;
          } catch {
            return envUrl.replace(/^file:/, '');
          }
        }
        return envUrl;
      }
      return './sqlite.db';
    })(),
  },
};

export default drizzleConfig;
