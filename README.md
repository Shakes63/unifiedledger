# Unified Ledger

Unified Ledger is a mobile-first personal finance app built with Next.js (App Router), Drizzle ORM, SQLite (default) and Better Auth.

## Local development

```bash
pnpm install
pnpm dev
```

App: `http://localhost:3000`

## Docker / Unraid Community Apps (CA)

Unified Ledger is designed to run as a **single container** on Unraid CA. The container:

- **Runs migrations automatically on startup** (non-interactive)
- **Persists data under `/config`** (Unraid appdata mount)
- Exposes the web UI on **port 3000**

### Ports

- **3000/tcp**: Web UI

### Persistent data contract

Mount `/config` as a persistent volume.

- **SQLite DB (default)**: `/config/finance.db`
- **Uploads**: `/config/uploads` (or set `UPLOADS_DIR`)

### Required environment variables

- **`NEXT_PUBLIC_APP_URL`**: public base URL used for auth redirects and email links  
  Example: `http://tower:3000` or `https://unifiedledger.example.com`
- **`BETTER_AUTH_SECRET`**: long random secret (required for production)
- **`DATABASE_URL`**:
  - SQLite default: `file:/config/finance.db`
  - Postgres optional: `postgresql://USER:PASSWORD@HOST:5432/unifiedledger` (Postgres **17+**)
    - Postgres migrations are shipped in-image under `drizzle/postgres` and run automatically on startup.
- **`FORCE_SECURE_COOKIES`**: defaults to `false`  
  If `NEXT_PUBLIC_APP_URL` starts with `https://`, cookies are marked Secure automatically; set `FORCE_SECURE_COOKIES=true` only if you know you need it.

### Uploads directory (recommended)

- **`UPLOADS_DIR`**: defaults to `/config/uploads` in production
  - Avatars are stored under `${UPLOADS_DIR}/avatars/<userId>.jpg`
  - Avatars are served via an authenticated route: `/uploads/avatars/<userId>.jpg`

### First run & upgrades

- **First run**: the container auto-applies DB migrations and creates tables.
- **Upgrades**: pulling a new image and restarting the container runs migrations again; if there are no pending migrations, startup continues normally.
- **If migrations fail**: the container exits non-zero and Unraid will show it as unhealthy; check logs for the reason.

### Health checks

- `GET /api/health` performs a real DB query and returns `503` if the DB is unreachable/misconfigured.

### Reverse proxy requirements (NPM / SWAG / Traefik)

When running behind a reverse proxy:

- Set `NEXT_PUBLIC_APP_URL` to the externally reachable URL (typically HTTPS).
- Ensure the proxy forwards `Host` and `X-Forwarded-Proto` correctly.

Login/session loops are almost always caused by:
- `NEXT_PUBLIC_APP_URL` not matching the public URL, or
- missing/incorrect forwarded headers.

### Maintainers: publishing the Unraid image (GHCR)

This repo includes a GitHub Actions workflow that publishes images to GHCR on release tags:

- Tag format: `vX.Y.Z`
- Image tags pushed:
  - `ghcr.io/<owner>/<repo>:X.Y.Z`
  - `ghcr.io/<owner>/<repo>:latest`

Workflow file: `.github/workflows/publish-ghcr.yml`

### Common Unraid failure modes (quick fixes)

- **Container exits immediately complaining about `BETTER_AUTH_SECRET`**
  - Set `BETTER_AUTH_SECRET` in your Unraid template (use a long random secret).
- **SQLite lock error: `/config/.migrate.lock` already exists**
  - Ensure only one container instance is running.
  - If a previous run crashed, delete `/config/.migrate.lock` and restart.
- **Scheduled jobs (autopay, backups) aren't running**
  - The container starts its own scheduler that triggers `/api/cron/*` endpoints.
    Check the logs for `[cron-scheduler] started`. It authenticates with
    `CRON_SECRET` (auto-generated to `/config/.cron-secret` when unset).
  - Using external cron instead? Set `CRON_SCHEDULER_DISABLED=true` and call the
    endpoints yourself with `Authorization: Bearer $CRON_SECRET`.

### Backup / restore

Three layers, from most to least automatic:

1. **Pre-migration snapshots** — before applying pending migrations at startup,
   the container writes a consistent copy of the DB to
   `/config/backups/pre-migration/` (last 3 kept). Rolling back a bad deploy:
   stop the container, copy the snapshot over `/config/finance.db`, start the
   previous image tag.
2. **Daily raw DB snapshots** — the backup cron writes a `VACUUM INTO` copy of
   the whole database to `/config/backups/db-snapshots/` (last 7 kept). Restore:
   stop the container, copy a snapshot over `/config/finance.db`, start.
3. **Per-household JSON exports** — the in-app scheduled backups
   (`/config/backups/<user>/<household>/`), restorable through the app's import.

**All of these live on the same disk as the database.** For real durability,
sync `/config/backups/` off-box — on Unraid, point a User Scripts rclone/rsync
job (or the CA Appdata Backup plugin) at another share or cloud storage.

**Do a restore drill once**: copy a `db-snapshots` file over a scratch
`finance.db`, boot a container against it, and confirm your data is there. An
untested backup is a hope, not a backup.

### Health monitoring

The container ships a Docker `HEALTHCHECK` against `/api/health`, so
`docker ps` shows `healthy`/`unhealthy`. To get NOTIFIED on Unraid instead of
noticing later:

- Install the **CA Docker Autostart/Monitor**-style notification plugin, or add
  a **User Scripts** cron (e.g. every 5 minutes):

  ```bash
  #!/bin/bash
  state=$(docker inspect -f '{{.State.Health.Status}}' unifiedledger 2>/dev/null)
  if [ "$state" != "healthy" ]; then
    /usr/local/emhttp/webGui/scripts/notify \
      -s "UnifiedLedger unhealthy" -d "Container health: ${state:-missing}" -i alert
  fi
  ```

- Also watch the startup logs after each update: the container prints
  `[verify-money-integrity]` results and `[cron-scheduler] started` on boot.
