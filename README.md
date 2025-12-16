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

### Persistent data contract

Mount `/config` as a persistent volume.

- **SQLite DB (default)**: `/config/finance.db`
- **Uploads**: `/config/uploads`

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

### First run & upgrades

- **First run**: the container auto-applies DB migrations and creates tables.
- **Upgrades**: pulling a new image and restarting the container runs migrations again; if there are no pending migrations, startup continues normally.
- **If migrations fail**: the container exits non-zero and Unraid will show it as unhealthy; check logs for the reason.

### Reverse proxy requirements (NPM / SWAG / Traefik)

When running behind a reverse proxy:

- Set `NEXT_PUBLIC_APP_URL` to the externally reachable URL (typically HTTPS).
- Ensure the proxy forwards `Host` and `X-Forwarded-Proto` correctly.

Login/session loops are almost always caused by:
- `NEXT_PUBLIC_APP_URL` not matching the public URL, or
- missing/incorrect forwarded headers.

### Backup / restore (minimum viable)

- Stop the container
- Back up the `/config` folder (at minimum `finance.db` + `uploads/`)
- Restore by putting the files back in `/config` and starting the container; migrations will run on startup.
