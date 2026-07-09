import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The app is SQLite-only. lib/db must fail LOUDLY at startup when DATABASE_URL
 * is a Postgres URL (support removed) or a malformed server-ish URL (M-DB-5),
 * instead of silently booting against a brand-new empty SQLite file.
 */
describe('lib/db DATABASE_URL guard', () => {
  const originalUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    vi.resetModules();
  });

  it('rejects a Postgres connection string', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/finance';
    vi.resetModules();
    await expect(import('@/lib/db')).rejects.toThrow(/Postgres support has been removed/);
  });

  it('rejects a postgres:// URL as well', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host/db';
    vi.resetModules();
    await expect(import('@/lib/db')).rejects.toThrow(/Postgres support has been removed/);
  });

  it('rejects a malformed server-like URL instead of creating an empty SQLite file (M-DB-5)', async () => {
    // The classic typo: "postgress://" — not a valid postgres scheme, not a file path.
    process.env.DATABASE_URL = 'postgress://user:pass@localhost:5432/finance';
    vi.resetModules();
    await expect(import('@/lib/db')).rejects.toThrow(/Refusing to fall back/);
  });
});
