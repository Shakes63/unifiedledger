# Agents

## Cursor Cloud specific instructions

### Overview

Unified Ledger is a single Next.js 16 (App Router) personal finance application using SQLite (default, via `better-sqlite3` + Drizzle ORM) and Better Auth for authentication. See `README.md` for full documentation.

### Running the dev server

```bash
pnpm dev
```

The server runs on port 3000. The `.env.local` file is loaded automatically by Next.js.

**Important:** Do not set `DATABASE_URL` in `.env.local` for local development. Omitting it causes the app to use the default `./sqlite.db` path, which is consistent between the app runtime and `drizzle-kit` migrations. Setting `DATABASE_URL=file:./relative-path` causes path-resolution mismatches between `lib/db/index.ts` (handles relative paths correctly) and `drizzle.config.sqlite.ts` (uses `new URL()` which loses relative path info).

### Database setup

Before the app works, SQLite migrations must be applied:

```bash
pnpm db:migrate:sqlite
```

This creates/updates `./sqlite.db` in the project root. The database file is not committed and must be recreated after cloning.

### Standard commands

| Task | Command |
|------|---------|
| Dev server | `pnpm dev` |
| Lint | `pnpm lint` |
| Tests | `pnpm test` |
| Test (watch) | `pnpm test:watch` |
| SQLite migrations | `pnpm db:migrate:sqlite` |
| DB Studio | `pnpm db:studio` |

### Gotchas

- The `pnpm.onlyBuiltDependencies` field in `package.json` must include `better-sqlite3`, `sharp`, `esbuild`, and `core-js` for native modules to compile. Without this, `pnpm install` skips their build scripts and the app fails at runtime.
- After deleting `.next`, the dev server must be restarted for Turbopack to regenerate its cache. If you see errors about missing `[turbopack]_runtime.js`, stop the server, delete `.next`, and restart.
- The health endpoint `GET /api/health` performs a real DB query. A 503 or "no such table" error means migrations haven't been applied.
- Pre-existing lint errors (4 errors, 13 warnings) and some test failures (53 of 955) exist in the codebase and are not caused by environment setup.
- The `.env.local` file needs at minimum `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_SECRET`, and optionally feature flags. OAuth and email provider configs are optional for local dev.
