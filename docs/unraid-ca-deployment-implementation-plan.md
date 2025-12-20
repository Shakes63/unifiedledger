# Unraid CA Deployment — Implementation Plan

Source of truth: `docs/unraid-ca-deployment-plan.md`.

This document turns the Unraid plan into a **concrete, file-level implementation checklist**. It also documents startup/upgrade behavior so Unraid CA users get reliable first-run + 1-click upgrade behavior.

## Hard requirements (must stay consistent with the plan)

- **Migrations**: `drizzle-kit migrate` (committed migrations), non-interactive.
- **Single container**: entrypoint runs migrations then starts the Next.js server.
- **Persistence**: `/config` is the contract (`/config/finance.db`, `/config/uploads`).
- **Postgres**: officially supported, **17+**.
- **Health**: `GET /api/health` checks DB connectivity and returns non-200 when DB is broken.
- **Cookies**: `FORCE_SECURE_COOKIES` defaults to `false`.

## Repo status (what exists today)

These pieces already exist in-repo and should be treated as the baseline:

- **Dual-dialect schema**
  - SQLite: `lib/db/schema.sqlite.ts`
  - Postgres: `lib/db/schema.pg.ts`
  - Runtime facade: `lib/db/schema.ts`
- **Dual-dialect migrations (committed)**
  - SQLite: `drizzle/sqlite/*`
  - Postgres: `drizzle/postgres/*`
- **Drizzle configs (split by dialect)**
  - SQLite: `drizzle.config.sqlite.ts`
  - Postgres: `drizzle.config.pg.ts`
- **Single-container entrypoint**
  - `scripts/docker-entrypoint.mjs` (runs `drizzle-kit migrate`, then starts `server.js`)
- **DB connectivity health check**
  - `app/api/health/route.ts` runs a real DB query and returns `503` on failure

## Concrete file-level changes (what we will touch)

This list is intentionally specific (files + intent), so we can implement in small safe commits.

### Docker / entrypoint / scripts

- `Dockerfile`
  - Ensure runtime image includes: `drizzle/`, `drizzle.config.*.ts`, schema files, and `scripts/docker-entrypoint.mjs`.
  - Keep **single-container** startup: entrypoint migrates then starts server.
- `scripts/docker-entrypoint.mjs`
  - Dialect detection from `DATABASE_URL`.
  - Non-interactive migration behavior (`CI=1`).
  - Locking: SQLite file lock; Postgres advisory lock.
  - **Preflight checks** (Task 1): fail fast with clear errors when migration artifacts/configs are missing or lock is stale.

### Drizzle configs & migrations

- `drizzle.config.sqlite.ts`
  - Default DB path: `/config/finance.db` in production when `DATABASE_URL` is unset.
  - Migrations output: `drizzle/sqlite`.
- `drizzle.config.pg.ts`
  - Migrations output: `drizzle/postgres`.
  - Placeholder URL only for generation; runtime requires `DATABASE_URL`.
- `drizzle/sqlite/**` + `drizzle/postgres/**`
  - Keep committed migration SQL in repo (required for unattended upgrades).

### DB adapter switch (runtime)

- `lib/db/dialect.ts`
  - `postgres://` and `postgresql://` → Postgres; everything else → SQLite.
- `lib/db/index.ts`
  - SQLite uses `better-sqlite3` persisted to `/config/finance.db` in production.
  - Postgres uses `pg` pool.

### Better Auth provider switch (runtime)

- `lib/better-auth.ts`
  - Adapter provider switches by dialect:
    - SQLite → `provider: "sqlite"` + `auth-schema.ts`
    - Postgres → `provider: "postgresql"` + `auth-schema.pg.ts`
  - `FORCE_SECURE_COOKIES` default `false`.
  - Secure cookies are enabled when `NEXT_PUBLIC_APP_URL` is `https://` (or forced).

## Startup + upgrade behavior (non-interactive) and failure modes

### Startup algorithm (container entrypoint)

1. Resolve `DATABASE_URL`:
   - If set → use it.
   - If unset → default to SQLite:
     - Production: `file:/config/finance.db`
     - Dev: `file:./sqlite.db`
2. Select dialect:
   - `postgres://` or `postgresql://` → Postgres
   - Otherwise → SQLite
3. Acquire migration lock:
   - SQLite: create `/config/.migrate.lock` exclusively (prevents concurrent migrations).
   - Postgres: `pg_advisory_lock(k1, k2)` held for migration duration.
4. Run migrations **non-interactively**:
   - `pnpm drizzle-kit migrate --config drizzle.config.<dialect>.ts`
5. Start app server:
   - `node server.js`

### Failure modes (and intended operator actions)

- **Missing `BETTER_AUTH_SECRET` in production**
  - Behavior: fail-fast before migrations; exit code `1`.
  - Fix: set `BETTER_AUTH_SECRET` in Unraid template.
- **SQLite lock file exists (`/config/.migrate.lock`)**
  - Behavior: entrypoint cannot acquire lock; exit code `1`.
  - Fix: ensure only one container instance is running. If a previous run crashed, delete `/config/.migrate.lock` and restart.
- **Bad/missing Postgres `DATABASE_URL`**
  - Behavior: migrations fail; exit code `1`.
  - Fix: correct `DATABASE_URL`, confirm Postgres is reachable and on v17+.
- **Missing migration artifacts/config inside image**
  - Behavior: migrations fail; exit code `1`.
  - Fix: use a newer image; this is an image-build issue. (Task 1 adds a clearer preflight error.)
- **Migration SQL error**
  - Behavior: migrations fail; exit code `1`.
  - Fix: check logs; restore from backup if needed; report issue with logs + schema version.

## SQLite vs Postgres differences + how migrations are selected

### Dialect selection

- SQLite when `DATABASE_URL` is:
  - `file:/...`, `file:///...`, or an absolute path like `/config/finance.db`
  - or unset (defaults)
- Postgres when `DATABASE_URL` starts with:
  - `postgres://` or `postgresql://`

### Migration selection

- SQLite:
  - Config: `drizzle.config.sqlite.ts`
  - Migrations dir: `drizzle/sqlite`
- Postgres:
  - Config: `drizzle.config.pg.ts`
  - Migrations dir: `drizzle/postgres`

## Reverse proxy requirements (NEXT_PUBLIC_APP_URL + forwarded headers)

Reverse proxies are supported, but **auth depends on correct public URL and forwarded headers**:

- **Set `NEXT_PUBLIC_APP_URL`** to the externally reachable URL (usually `https://...`).
- Ensure proxy forwards:
  - `Host`
  - `X-Forwarded-Proto`
- Cookies:
  - `FORCE_SECURE_COOKIES=false` by default.
  - Secure cookies are enabled when `NEXT_PUBLIC_APP_URL` starts with `https://`.

## Data persistence contract (/config) + backup/restore

### Persistence contract (Unraid appdata)

- SQLite DB: `/config/finance.db`
- Uploads root: `/config/uploads` (configurable via `UPLOADS_DIR`)

### Minimum viable backup / restore

- **Backup**
  - Stop the container.
  - Back up `/config` (at minimum `finance.db` and `uploads/`).
- **Restore**
  - Put files back under `/config`.
  - Start container; migrations run automatically.

## Task list (ordered)

### Task 1 — Preflight hardening + docs/config consistency (implement next)

- Add entrypoint **preflight checks** in `scripts/docker-entrypoint.mjs`:
  - Verify the selected drizzle config file exists before running migrate.
  - Verify the selected migrations directory exists (and includes `meta/_journal.json`) before running migrate.
  - Improve SQLite lock error messaging to include the remediation steps.
- Update `docs/unraid-ca-deployment-plan.md` to stay accurate as we learn details during Task 1.
- Update `docker-compose.yml` comments/example to reference Postgres **17+** (not 15).

### Task 2 — README: Unraid operator guide

- Expand README “Docker / Unraid CA” section:
  - Required env vars + defaults
  - First-run behavior
  - Upgrade behavior (non-interactive migrations)
  - Failure modes troubleshooting
  - Backup/restore instructions

### Task 3 — CI/publishing + CA template packaging

- Add GHCR publish workflow (multi-arch optional) and document tags.
- Export CA template snippet (XML) for submission.
