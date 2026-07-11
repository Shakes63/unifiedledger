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
- **`DATABASE_URL`**: SQLite, default `file:/config/finance.db`
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

### Maintainers: release channels

Two image channels are published to GHCR:

- **`:nightly` (pre-release channel)** — rebuilt on every push to `main`
  (`.github/workflows/nightly.yml`). Ungated (no test run) and intended for the
  maintainer's own box to try changes before cutting a release. Each build is
  also tagged `sha-<commit>` for rollback.
- **`:latest` / `X.Y.Z` (stable channel)** — published only when a version tag
  is cut. This is what user deployments should track.

CI (type check, migration verification, full test suite, money-integrity check)
runs when a release is cut and on pull requests — not on pushes to `main`.
To cut a release from `main`:

```bash
pnpm release:patch   # or release:minor / release:major / release:rc
```

This bumps `package.json`, commits, tags `vX.Y.Z`, and pushes `main` with the
tag. The tag triggers `.github/workflows/publish-ghcr.yml`, which:

1. Runs the full test workflow — a failing suite blocks the release
2. Builds and pushes the image to GHCR tagged `X.Y.Z`, `X.Y`, and `latest`
3. Scans the published image with Trivy (results in the repo's Security tab)
4. Creates a GitHub Release with auto-generated notes

`release:rc` cuts a pre-release (`vX.Y.Z-rc.N`): same gated pipeline, but the
image is tagged only with its exact version (`:latest` and `X.Y` don't move)
and the GitHub Release is marked as a pre-release — useful for sharing a
release candidate without pushing it to everyone on `:latest`.

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
