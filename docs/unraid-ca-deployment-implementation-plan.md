# Unraid CA Deployment — Implementation Plan (Source of truth: `docs/unraid-ca-deployment-plan.md`)

This document turns the Unraid CA deployment plan into **concrete repo changes**. It’s intentionally file-level and operational so we can implement in small, safe commits.

## Key constraints (must match the plan)

- **Migrations**: use `drizzle-kit migrate` (non-interactive), not `push`
- **Single container**: entrypoint runs migrations then starts the server
- **Persistence**: `/config` is the contract (`/config/finance.db`, `/config/uploads`)
- **Postgres**: officially supported, **17+**
- **Health**: `GET /api/health` checks DB connectivity and returns non-200 if DB is broken
- **Cookies**: `FORCE_SECURE_COOKIES` defaults to `false`

## Repo reality (discovered during implementation)

- Current Drizzle schema is **SQLite-only** (`lib/db/schema.ts` imports `drizzle-orm/sqlite-core`).
- Current Docker uses a **separate “migrator” stage** and `drizzle-kit push`.
- `drizzle/` directory is currently **empty**, so we’ll be creating the initial migration history.
- `lib/db/schema.ts` contains many defaults like `default(new Date().toISOString())` which are **unsafe for committed migrations** (they bake build-time timestamps into SQL).

## Planned changes (concrete, file-level)

### 1) Add Unraid/CA runtime contract + entrypoint (single-container migrate-then-start)

- **Add** `scripts/docker-entrypoint.mjs`
  - Detect DB dialect from `DATABASE_URL`
  - Run migrations (non-interactive) using `pnpm drizzle-kit migrate --config ...`
  - Enforce concurrency locks:
    - SQLite: file lock in `/config/.migrate.lock`
    - Postgres: advisory lock (via `pg` client) around migrate
  - On failure: log a clear error and `process.exit(1)`
  - On success: `spawn("node", ["server.js"])`

- **Update** `Dockerfile`
  - Switch persisted data dir from `/app/data` to `/config`
  - Copy migration configs + `drizzle/` outputs into the runtime image
  - Set entrypoint to `node scripts/docker-entrypoint.mjs`
  - Keep `HEALTHCHECK` using `GET /api/health`

Failure modes (non-interactive):
- **Migration fails**: container exits non-zero → Unraid shows stopped/unhealthy; logs include dialect + config used.
- **DB misconfigured**: migrate fails quickly (bad URL, permissions, missing `/config` mount).
- **Concurrent startups**: lock prevents simultaneous migrations; second instance fails fast with a message (or waits—decide per implementation).

### 2) Split Drizzle configs + scripts for dialect-specific migrations

- **Add** `drizzle.config.sqlite.ts`
  - `dialect: "sqlite"`
  - `out: "./drizzle/sqlite"`
  - `schema: ["./lib/db/schema.ts", "./auth-schema.ts"]`
  - `dbCredentials.url`: resolve from `DATABASE_URL` (default `file:/config/finance.db` in production images)

- **Add** `drizzle.config.pg.ts`
  - `dialect: "postgresql"`
  - `out: "./drizzle/postgres"`
  - `schema`: **Postgres-compatible schema** (see section 3)
  - `dbCredentials.url`: use `process.env.DATABASE_URL`

- **Update** `package.json` scripts
  - `db:generate:sqlite` → `drizzle-kit generate --config drizzle.config.sqlite.ts`
  - `db:generate:pg` → `drizzle-kit generate --config drizzle.config.pg.ts`
  - `db:migrate:sqlite` → `drizzle-kit migrate --config drizzle.config.sqlite.ts`
  - `db:migrate:pg` → `drizzle-kit migrate --config drizzle.config.pg.ts`

### 3) SQLite vs Postgres schema strategy (strict TS; minimize churn)

We need **dialect-specific schema definitions** because Drizzle schema builders are different (`sqlite-core` vs `pg-core`). The repo currently has SQLite-only schema.

Plan:

- **Rename** current SQLite schema:
  - `lib/db/schema.ts` → `lib/db/schema.sqlite.ts` (exact contents, but also fix unsafe defaults — see section 4)
- **Add** Postgres schema:
  - `lib/db/schema.pg.ts` (converted definitions)
- **Add** a stable import surface for the app:
  - `lib/db/schema.ts` becomes a **facade** that exports tables from the correct dialect at runtime.

TypeScript note:
- The facade must avoid `any`. If we can’t keep perfect per-column inference across dialects, we’ll keep casting contained to `lib/db/schema.ts` using `unknown` + Drizzle’s exported types (e.g. `AnyTable`) so the rest of the app stays strict and unchanged.

### 4) Fix migration-unsafe defaults in schema (required before generating initial migrations)

Replace `default(new Date().toISOString())` patterns with database-evaluated defaults so migrations don’t bake build-time timestamps.

Strategy:
- Prefer a consistent UTC timestamp representation:
  - SQLite: `sql\`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))\``
  - Postgres: use `sql\`(to_char((now() at time zone 'utc'),'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'))\``
- Alternatively, switch these columns to real timestamps (`timestamp`/`timestamptz`) in Postgres and keep `text` in SQLite, but that is a larger refactor.

### 5) DB connection selection (`lib/db/index.ts`) + Better Auth provider selection (`lib/better-auth.ts`)

- **Update** `lib/db/index.ts`
  - Detect dialect from `DATABASE_URL` prefix:
    - `postgres://` or `postgresql://` → Postgres (`pg.Pool` + `drizzle-orm/node-postgres`)
    - otherwise → SQLite (`better-sqlite3` + `drizzle-orm/better-sqlite3`)
  - Default `DATABASE_URL` (when unset):
    - production: `file:/config/finance.db`
    - dev/test: current `./sqlite.db` behavior

- **Update** `lib/better-auth.ts`
  - Switch `drizzleAdapter(..., { provider })` based on dialect:
    - SQLite → `provider: "sqlite"`
    - Postgres → `provider: "postgresql"` (confirm exact value expected by Better Auth Drizzle adapter)

### 6) Health check: ensure it works for both DBs

- **Update** `app/api/health/route.ts` if needed
  - It already runs a simple DB query; ensure it works for both dialects once DB selection exists.
  - Keep returning 503 on DB errors.

### 7) Documentation updates (plan + README)

- **Update** `docs/unraid-ca-deployment-plan.md`
  - Document the schema strategy change (dialect-specific schema files + facade)
  - Document the “migration-unsafe defaults” fix requirement
  - Confirm `/config` default and entrypoint behavior

- **Update** `README.md`
  - Add “Unraid / Docker (CA)” section:
    - Required env vars: `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`
    - Defaults: port 3000, `FORCE_SECURE_COOKIES=false`
    - First run: migrations create tables automatically
    - Upgrades: image update triggers auto-migrate on startup
    - Persistence: `/config/finance.db`, `/config/uploads`
    - Backup/restore: stop container, copy `/config` (or at least DB + uploads)

## Reverse proxy requirements (NPM/SWAG/Traefik)

- **Required**: `NEXT_PUBLIC_APP_URL` must match the externally reachable base URL
- **Forwarded headers**: proxies must pass `Host` and `X-Forwarded-Proto` (so HTTPS is detected)
- If you get login/session loops:
  - mismatch between `NEXT_PUBLIC_APP_URL` and public URL, or missing forwarded headers

## Migration selection rules (SQLite vs Postgres)

- `DATABASE_URL` starts with `postgres://` or `postgresql://` → use `drizzle.config.pg.ts` and migrations in `drizzle/postgres`
- Otherwise → use `drizzle.config.sqlite.ts` and migrations in `drizzle/sqlite`

## Data persistence contract (/config)

- **DB**:
  - SQLite: `/config/finance.db`
  - Postgres: external (not stored in container)
- **Uploads**:
  - root: `/config/uploads`

Backup/restore notes:
- SQLite backups should be done with the container stopped (minimum viable guidance).
- To restore: replace `/config/finance.db` (and `/config/uploads`) then start container; migrations will re-apply if needed.

## First implementation task (what we do next)

Implement **Step 2 (split Drizzle configs + scripts)** plus the **entrypoint skeleton** that selects dialect + runs `drizzle-kit migrate` (SQLite first), without changing app behavior beyond Docker/Unraid readiness.


