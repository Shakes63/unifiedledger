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

- Dual-dialect schemas exist:
  - SQLite: `lib/db/schema.sqlite.ts`
  - Postgres: `lib/db/schema.pg.ts`
  - Facade: `lib/db/schema.ts` exports the correct tables at runtime based on `DATABASE_URL`.
- Dual-dialect migrations exist and are committed:
  - SQLite: `drizzle/sqlite/*`
  - Postgres: `drizzle/postgres/*`
- Drizzle configs exist:
  - `drizzle.config.sqlite.ts`
  - `drizzle.config.pg.ts`
- Docker already follows the CA contract:
  - `/config` exists in-image and is intended as the persisted mount
  - `scripts/docker-entrypoint.mjs` runs `drizzle-kit migrate` then starts the server
- Migration-unsafe timestamp defaults have been addressed via DB-evaluated defaults (see `sqliteNowIso` / `pgNowIso` in the schema files).

## Planned changes (concrete, file-level)

### 1) Entry point + Docker (single-container migrate-then-start)

- **Already implemented**:
  - `scripts/docker-entrypoint.mjs` runs `drizzle-kit migrate` non-interactively and then starts `server.js`
  - `Dockerfile` creates `/config`, includes migrations/configs, and starts the entrypoint
  - Healthcheck hits `GET /api/health`

### 2) Migration generation, selection, and non-interactive behavior

- **SQLite vs Postgres migration selection**
  - Postgres (`postgres://` or `postgresql://`) → `drizzle.config.pg.ts` and `drizzle/postgres`
  - Otherwise → `drizzle.config.sqlite.ts` and `drizzle/sqlite`

- **Non-interactive upgrade behavior**
  - Startup runs migrations first. If migrations fail, the container exits non-zero.
  - SQLite concurrency is prevented with `/config/.migrate.lock`.
  - Postgres concurrency is prevented with an advisory lock (`pg_advisory_lock(k1, k2)`).

### 3) SQLite vs Postgres differences (schema + runtime)

- **Schemas**
  - SQLite schema: `lib/db/schema.sqlite.ts` (`sqliteTable`, booleans via `integer(..., { mode: 'boolean' })`, numeric via `real`)
  - Postgres schema: `lib/db/schema.pg.ts` (`pgTable`, booleans via `boolean`, numeric via `doublePrecision`)
  - App imports: `lib/db/schema.ts` selects the right tables at runtime.

- **Timestamp defaults**
  - SQLite uses `sqliteNowIso` and Postgres uses `pgNowIso` to avoid build-time defaults baked into migrations.

### 4) Reverse proxy requirements (NEXT_PUBLIC_APP_URL + forwarded headers)

- Set `NEXT_PUBLIC_APP_URL` to the externally reachable base URL (typically HTTPS behind a proxy).
- Ensure the proxy forwards `Host` and `X-Forwarded-Proto`.
- `FORCE_SECURE_COOKIES` defaults to `false`; Secure cookies are enabled when `NEXT_PUBLIC_APP_URL` starts with `https://` (or by explicit override).

### 5) Data persistence contract (/config) + backup/restore notes

- **SQLite DB**: `/config/finance.db`
- **Uploads**: `/config/uploads` (or configure `UPLOADS_DIR`)

Minimum viable backup/restore:
- Stop the container, back up `/config` (at minimum `finance.db` and `uploads/`)
- Restore by putting files back under `/config` and starting the container (migrations run on startup)

## Next implementation task

### Task 1 — Production hardening + docs consistency

- **Update** `scripts/docker-entrypoint.mjs`: in `NODE_ENV=production`, require `BETTER_AUTH_SECRET` (fail fast at startup, runtime-only so builds remain reproducible).
- **Update** `scripts/docker-entrypoint.mjs`: remove outdated messaging implying Postgres migrations might be missing.
- **Update** `docs/unraid-ca-deployment-plan.md`: align “repo status” narrative with the current implementation.
