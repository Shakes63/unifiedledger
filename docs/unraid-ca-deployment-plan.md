# Unified Ledger - Unraid Community Apps Deployment Plan (SQLite default + Optional Postgres)

This plan describes how to publish Unified Ledger as an **Unraid Community Apps (CA)** container with:

- **Default DB**: SQLite, persisted under `/config`
- **Optional DB**: Postgres (users provide a full `DATABASE_URL`, Postgres 17+)
- **1-click updates**: Unraid pulls a new image and the container **auto-runs non-interactive migrations on startup**

> **Implementation status: Core runtime COMPLETE.** Remaining: CI publishing + CA template submission.
> - Dual-dialect schemas (`lib/db/schema.sqlite.ts` + `lib/db/schema.pg.ts`)
> - Split Drizzle configs (`drizzle.config.sqlite.ts` + `drizzle.config.pg.ts`)
> - Committed migrations under `drizzle/sqlite` and `drizzle/postgres`
> - Auto-migrating Docker entrypoint (`scripts/docker-entrypoint.mjs`) with concurrent migration locks
> - Better Auth adapter provider switching (`lib/better-auth.ts`)
> - Production secret enforcement (BETTER_AUTH_SECRET required at runtime)
> - CA template artifact: `docs/unraid-ca-template.xml` (fill in your org/repo details)

---

## Goals & Constraints

- **Single-container CA app**: Unraid CA templates are best when a single container provides the app (DB can be external/optional).
- **Persistent data**: DB and durable files must live under `/config` (mapped to Unraid appdata).
- **Unattended upgrades**: DB migrations must be **non-interactive**, **repeatable**, and **safe**.
- **Two DB backends**: SQLite and Postgres have different SQL dialects, so migration artifacts must be separated.

---

## Decisions Made

These were the key architectural decisions made during implementation.

### 0) Migration strategy for CA upgrades

**Decision: Committed migrations + `drizzle-kit migrate`**

For unattended CA upgrades, we use committed migration files rather than `drizzle-kit push`. This ensures:
- Deterministic, auditable, safe upgrades
- No interactive prompts during container startup
- Separate migration files for SQLite and Postgres dialects

**Implemented in:** `scripts/docker-entrypoint.mjs` runs `drizzle-kit migrate` on startup.

### 1) Production data location

**Decision: Standardize on `/config` for CA**

- SQLite default: `DATABASE_URL=file:/config/finance.db`
- Uploads root: `/config/uploads`
- Optional backups/exports: `/config/backups`

**Implemented in:** `lib/db/index.ts`, `scripts/docker-entrypoint.mjs`, and `drizzle.config.sqlite.ts` all default to `/config/finance.db` when `NODE_ENV=production`.

### 2) Migration execution model

**Decision: Single container entrypoint runs migrations then starts server**

The Docker entrypoint performs migrations and then starts the Next.js server in a single container. This provides the best "1-click update" UX for Unraid CA.

**Implemented in:** `scripts/docker-entrypoint.mjs` — detects DB dialect, acquires migration lock (file lock for SQLite, `pg_advisory_lock` for Postgres), runs `drizzle-kit migrate`, then starts `node server.js`.

### 3) Postgres support

**Decision: Postgres is officially supported (minimum version 17+)**

- Full Postgres schema (`lib/db/schema.pg.ts`) and auth schema (`auth-schema.pg.ts`)
- Committed migrations under `drizzle/postgres`
- Better Auth adapter switches provider based on DATABASE_URL

**Implemented in:** `lib/db/index.ts` (connection switching), `lib/db/dialect.ts` (dialect detection), `lib/better-auth.ts` (adapter provider switching).

### 4) Cookie security defaults

**Decision: Auto-detect secure cookies from URL scheme**

- `FORCE_SECURE_COOKIES` defaults to `false`
- Cookies are automatically marked `Secure` when `NEXT_PUBLIC_APP_URL` starts with `https://`
- Manual override available via `FORCE_SECURE_COOKIES=true`

**Implemented in:** `lib/better-auth.ts` — `shouldUseSecureCookies()` function.

---

## Target Unraid Runtime Contract

### Persistent paths

- `/config` (required): Unraid appdata mount (e.g. `/mnt/user/appdata/unifiedledger`)
  - SQLite DB path (default): `/config/finance.db`
  - Uploads (persisted): `/config/uploads`
  - Optional: backups/exports: `/config/backups`

### Required environment variables

- `DATABASE_URL`
  - SQLite default: `file:/config/finance.db`
  - Postgres optional: `postgresql://USER:PASSWORD@HOST:5432/unifiedledger`
- `NEXT_PUBLIC_APP_URL`
  - e.g. `http://tower:3000` or reverse proxy URL like `https://unifiedledger.example.com`
- `BETTER_AUTH_SECRET`
  - long random secret (required in production)
- `FORCE_SECURE_COOKIES` (recommended for public exposure)
  - Default: `false`
  - If unset/false, cookies are marked Secure automatically when `NEXT_PUBLIC_APP_URL` starts with `https://`.
  - Set to `true` only if you need to force Secure cookies regardless of URL (generally not recommended unless you know why).

### Optional environment variables (feature-dependent)

- **Email**
  - `EMAIL_PROVIDER=none|resend|smtp`
  - Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`
  - SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME`
- **OAuth**
  - Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - GitHub: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- **Encryption**
  - `OAUTH_ENCRYPTION_KEY` (recommended if storing sensitive OAuth settings at rest)

---

## Step 1 — DB-agnostic runtime (SQLite + Postgres) ✅ IMPLEMENTED

### 1.1 Database connection selection (Drizzle) ✅

**Implemented in `lib/db/index.ts`:**

- Detects DB type from `DATABASE_URL` via `lib/db/dialect.ts`:
  - `postgres://` or `postgresql://` → Postgres driver (`pg` + `drizzle-orm/node-postgres`)
  - `file:` or filesystem path → SQLite driver (`better-sqlite3` + `drizzle-orm/better-sqlite3`)
- Exports `db`, `sqlite`, and `pgPool` for use throughout the app
- Default production path: `/config/finance.db` when `DATABASE_URL` is not set

### 1.2 Better Auth adapter provider switch ✅

**Implemented in `lib/better-auth.ts`:**

- Drizzle adapter provider dynamically selected based on dialect:
  - SQLite → `provider: "sqlite"`
  - Postgres → `provider: "postgresql"`
- Auth schema also switches: `auth-schema.ts` (SQLite) vs `auth-schema.pg.ts` (Postgres)

### 1.3 Schema compatibility across dialects ✅

**Implemented as separate schema files:**

- `lib/db/schema.sqlite.ts` — SQLite-specific schema
- `lib/db/schema.pg.ts` — Postgres-specific schema
- `lib/db/schema.ts` — Re-exports the appropriate schema based on runtime dialect

Key differences handled:
- JSON storage (text in SQLite, native JSON in Postgres)
- Default timestamps use `sqliteNowIso` / `pgNowIso` to avoid baking build-time values
- Dialect-specific SQL fragments

---

## Step 2 — Non-interactive migrations for both dialects ✅ IMPLEMENTED

### 2.1 Committed migrations (not push) ✅

Production uses `drizzle-kit migrate` with committed migration files, not `drizzle-kit push`. This ensures deterministic, non-interactive upgrades.

### 2.2 Split migration outputs by dialect ✅

**Implemented Drizzle configs:**

- `drizzle.config.sqlite.ts` → outputs to `./drizzle/sqlite`
- `drizzle.config.pg.ts` → outputs to `./drizzle/postgres`

Both directories contain committed migration SQL files.

### 2.3 Migration generation workflow (developer)

When changing schema, generate migrations for both dialects:

```bash
pnpm drizzle-kit generate --config drizzle.config.sqlite.ts
pnpm drizzle-kit generate --config drizzle.config.pg.ts
```

Commit both outputs.

**Important**: Avoid `default(new Date().toISOString())` in schema definitions — use `sqliteNowIso` / `pgNowIso` instead to avoid baking build-time timestamps.

### 2.4 Startup auto-migration runner ✅

**Implemented in `scripts/docker-entrypoint.mjs`:**

1. Enforces `BETTER_AUTH_SECRET` in production (fail-fast)
2. Detects dialect from `DATABASE_URL`
3. Acquires migration lock (prevents concurrent migrations)
4. Runs `drizzle-kit migrate --config <dialect-config>`
5. Starts `node server.js`

**Behavior:**
- Non-interactive (CI=1 environment variable)
- Exits non-zero on migration failure
- Logs DB type, migration status, and any errors

**Runtime image includes:** `drizzle/`, `drizzle.config.*.ts`, schema files

### 2.5 Concurrent migration locks ✅

**Implemented in `scripts/docker-entrypoint.mjs`:**

- **SQLite**: File lock at `/config/.migrate.lock`
- **Postgres**: Advisory lock via `pg_advisory_lock(8291, 33001)` held for migration duration

---

## Step 3 — Docker image design for CA ✅ IMPLEMENTED

### 3.1 Single image supports both DB modes ✅

The published image:
- Runs Next.js standalone
- Runs migrations on startup for either SQLite or Postgres
- Includes drizzle-kit for migration execution (Option 1 approach)

### 3.2 Persistence expectation ✅

- `/config` mount is the standard appdata location
- Default `DATABASE_URL=file:/config/finance.db` when not explicitly set

### 3.3 Healthcheck / readiness contract

The Dockerfile uses `GET /api/health` to determine container health.

**Recommendation:** `/api/health` should validate DB connectivity and return non-200 if the DB is unavailable/misconfigured.

---

## Step 4 — CI: Publish images for Unraid CA

### 4.1 Registry

Recommended: GitHub Container Registry (GHCR)

- `ghcr.io/<org>/unifiedledger:<version>`
- optional: `:latest`

### 4.2 Tagging strategy

- Release tags: `vX.Y.Z` → image tag `X.Y.Z`
- Optional: also publish `latest` on stable releases

### 4.3 Multi-arch

At minimum: `linux/amd64` (most Unraid servers)
Not planned initially: `linux/arm64`

---

## Step 5 — CA Template

This template defaults to SQLite but supports Postgres by letting the user change `DATABASE_URL`.

```xml
<?xml version="1.0"?>
<Container version="2">
  <Name>UnifiedLedger</Name>
  <Repository>ghcr.io/YOUR_ORG/unifiedledger:latest</Repository>
  <Registry>https://ghcr.io</Registry>
  <Network>bridge</Network>
  <Shell>bash</Shell>
  <Privileged>false</Privileged>

  <Support>https://github.com/YOUR_ORG/unifiedledger/issues</Support>
  <Project>https://github.com/YOUR_ORG/unifiedledger</Project>

  <Overview>
Unified Ledger (Next.js) personal finance app.

Default DB: SQLite persisted in /config/finance.db
Optional DB: Postgres via DATABASE_URL (install Postgres separately in Unraid CA; Postgres 17+)

On startup, the container auto-runs migrations for the configured database, enabling 1-click updates.
  </Overview>

  <Category>Finance: Tools</Category>
  <WebUI>http://[IP]:[PORT:3000]/</WebUI>

  <!-- Persistent appdata -->
  <Config Name="Appdata" Target="/config" Default="/mnt/user/appdata/unifiedledger" Mode="rw"
          Description="Persistent data (SQLite DB, uploads, config)" Type="Path" Display="always" Required="true"/>

  <!-- Port -->
  <Config Name="Web Port" Target="3000" Default="3000" Mode="tcp"
          Description="Web UI Port" Type="Port" Display="always" Required="true"/>

  <!-- Required app env -->
  <Config Name="App URL" Target="NEXT_PUBLIC_APP_URL" Default="http://[IP]:[PORT:3000]" Mode="rw"
          Description="Public base URL used for auth redirects and email links" Type="Variable" Display="always" Required="true"/>

  <Config Name="Better Auth Secret" Target="BETTER_AUTH_SECRET" Default="" Mode="rw"
          Description="Required. Set a long random secret." Type="Variable" Display="always" Required="true" Mask="true"/>

  <Config Name="Force Secure Cookies (advanced)" Target="FORCE_SECURE_COOKIES" Default="false" Mode="rw"
          Description="Advanced. If false, Secure cookies are enabled automatically when NEXT_PUBLIC_APP_URL is https. Set true only if you need to force Secure cookies."
          Type="Variable" Display="advanced" Required="false"/>

  <!-- Database selection -->
  <Config Name="DATABASE_URL (SQLite default, Postgres optional)" Target="DATABASE_URL" Default="file:/config/finance.db" Mode="rw"
          Description="SQLite: file:/config/finance.db  |  Postgres: postgresql://user:pass@host:5432/unifiedledger"
          Type="Variable" Display="always" Required="true"/>

  <!-- Uploads persistence (recommended) -->
  <Config Name="UPLOADS_DIR" Target="UPLOADS_DIR" Default="/config/uploads" Mode="rw"
          Description="Filesystem uploads root (avatars at /uploads/avatars/<userId>.jpg). Persist under /config in Unraid."
          Type="Variable" Display="advanced" Required="false"/>

  <!-- Recommended runtime flags -->
  <Config Name="PORT" Target="PORT" Default="3000" Mode="rw"
          Description="Port the app listens on inside the container" Type="Variable" Display="advanced" Required="false"/>
  <Config Name="HOSTNAME" Target="HOSTNAME" Default="0.0.0.0" Mode="rw"
          Description="Bind address inside the container" Type="Variable" Display="advanced" Required="false"/>
  <Config Name="NEXT_TELEMETRY_DISABLED" Target="NEXT_TELEMETRY_DISABLED" Default="1" Mode="rw"
          Description="Disable Next.js telemetry" Type="Variable" Display="advanced" Required="false"/>

  <!-- Optional email -->
  <Config Name="Email Provider" Target="EMAIL_PROVIDER" Default="none" Mode="rw"
          Description="none | resend | smtp" Type="Variable" Display="advanced" Required="false"/>

  <Config Name="Resend API Key" Target="RESEND_API_KEY" Default="" Mode="rw"
          Description="Resend API key (if using resend)" Type="Variable" Display="advanced" Required="false" Mask="true"/>
  <Config Name="Resend From Email" Target="RESEND_FROM_EMAIL" Default="onboarding@resend.dev" Mode="rw"
          Description="From email for Resend" Type="Variable" Display="advanced" Required="false"/>
  <Config Name="Resend From Name" Target="RESEND_FROM_NAME" Default="Unified Ledger" Mode="rw"
          Description="From name for Resend" Type="Variable" Display="advanced" Required="false"/>

  <Config Name="SMTP Host" Target="SMTP_HOST" Default="" Mode="rw"
          Description="SMTP host (if using smtp)" Type="Variable" Display="advanced" Required="false"/>
  <Config Name="SMTP Port" Target="SMTP_PORT" Default="587" Mode="rw"
          Description="SMTP port" Type="Variable" Display="advanced" Required="false"/>
  <Config Name="SMTP Secure" Target="SMTP_SECURE" Default="false" Mode="rw"
          Description="true for SMTPS/465" Type="Variable" Display="advanced" Required="false"/>
  <Config Name="SMTP User" Target="SMTP_USER" Default="" Mode="rw"
          Description="SMTP username" Type="Variable" Display="advanced" Required="false"/>
  <Config Name="SMTP Password" Target="SMTP_PASSWORD" Default="" Mode="rw"
          Description="SMTP password" Type="Variable" Display="advanced" Required="false" Mask="true"/>
  <Config Name="SMTP From" Target="SMTP_FROM" Default="noreply@localhost" Mode="rw"
          Description="From email for SMTP" Type="Variable" Display="advanced" Required="false"/>
  <Config Name="SMTP From Name" Target="SMTP_FROM_NAME" Default="Unified Ledger" Mode="rw"
          Description="From name for SMTP" Type="Variable" Display="advanced" Required="false"/>

  <!-- Optional OAuth -->
  <Config Name="Google Client ID" Target="GOOGLE_CLIENT_ID" Default="" Mode="rw"
          Description="Optional Google OAuth client ID" Type="Variable" Display="advanced" Required="false"/>
  <Config Name="Google Client Secret" Target="GOOGLE_CLIENT_SECRET" Default="" Mode="rw"
          Description="Optional Google OAuth client secret" Type="Variable" Display="advanced" Required="false" Mask="true"/>
  <Config Name="GitHub Client ID" Target="GITHUB_CLIENT_ID" Default="" Mode="rw"
          Description="Optional GitHub OAuth client ID" Type="Variable" Display="advanced" Required="false"/>
  <Config Name="GitHub Client Secret" Target="GITHUB_CLIENT_SECRET" Default="" Mode="rw"
          Description="Optional GitHub OAuth client secret" Type="Variable" Display="advanced" Required="false" Mask="true"/>

  <!-- Optional encryption -->
  <Config Name="OAuth Encryption Key" Target="OAUTH_ENCRYPTION_KEY" Default="" Mode="rw"
          Description="Optional encryption key for OAuth settings at rest" Type="Variable" Display="advanced" Required="false" Mask="true"/>
</Container>
```

---

## Step 6 — Documentation to ship alongside CA

Add a concise “Database Modes” section to README (and/or CA Overview):

- **SQLite (default)**
  - Leave `DATABASE_URL` at default `file:/config/finance.db`
  - Most users should choose this
- **Postgres (optional)**
  - Install Postgres separately
  - Create database/user
  - Set `DATABASE_URL=postgresql://...`
  - Container will auto-run migrations on startup

Also include:

- Reverse proxy guidance (set `NEXT_PUBLIC_APP_URL` to the externally reachable URL)
- How to rotate secrets safely (`BETTER_AUTH_SECRET`)

---

## Additional items (implementation notes)

### A) CA-friendly Docker runtime contract ✅

Runtime env vars included in CA template:

- `PORT=3000`
- `HOSTNAME=0.0.0.0`
- `NODE_ENV=production`
- `NEXT_TELEMETRY_DISABLED=1`

### B) Uploads + avatars ✅

**Implemented:**
- `UPLOADS_DIR` env var (default `/config/uploads` in production)
- Avatars stored at `${UPLOADS_DIR}/avatars/<userId>.jpg` (optimized JPEG)
- Served via authenticated route handler: `GET /uploads/avatars/<userId>.jpg`
- Legacy migration: best-effort copy from `public/uploads/avatars` on startup

### C) First-run initialization

- Migrations auto-create all required tables on first run
- Onboarding is entirely user-driven (no seed data required)

### D) Backup/restore guidance (recommended for docs)

Add a short doc section for Unraid users:

- How to back up `/config/finance.db` (and `/config/uploads`) safely
- For SQLite, recommend stopping the container before copying DB (or using SQLite backup API if implemented later)

---

## Reverse Proxy Considerations (SWAG / Nginx Proxy Manager / Traefik)

### Required app settings

- **Set `NEXT_PUBLIC_APP_URL`** to the externally reachable URL:
  - Example: `https://unifiedledger.example.com`
- **Use HTTPS** at the proxy when exposing to the internet.

### Cookies / auth notes

Unified Ledger uses Better Auth cookies. For production behind HTTPS, confirm the Better Auth cookie settings are appropriate for your deployment:

- If the app is accessed via HTTPS, cookies should be marked `Secure`.
- If you terminate TLS at the proxy, ensure forwarded headers are correct (commonly `X-Forwarded-Proto: https`) and set `NEXT_PUBLIC_APP_URL` to your public `https://` URL.

If you see login loops or sessions not sticking, this is usually one of:

- `NEXT_PUBLIC_APP_URL` not matching the public URL
- Proxy not forwarding `X-Forwarded-*` headers correctly
- Cookie secure policy mismatched for HTTP vs HTTPS

### Documented “default” reverse proxy: Nginx Proxy Manager (NPM)

NPM is the easiest default to document for Unraid users because it is UI-driven.

Recommended NPM settings:

- Create a **Proxy Host**
  - **Domain Names**: `unifiedledger.example.com`
  - **Scheme**: `http`
  - **Forward Hostname / IP**: the container name or host IP
  - **Forward Port**: `3000`
  - Enable **Websockets Support**
- SSL tab:
  - Request a Let’s Encrypt cert for the domain
  - Enable **Force SSL**
- Advanced tab (if needed):
  - Ensure headers preserve `Host` and set `X-Forwarded-Proto $scheme`

Suggested NPM “Advanced” snippet (only if you’re troubleshooting auth loops):

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

### SWAG support (nginx config users)

SWAG is also nginx, but config-file oriented. The key support requirements are the same:

- Forward `Host`
- Set `X-Forwarded-Proto` to `https`
- Proxy to the app container on port `3000`

Provide a sample `proxy-confs/unifiedledger.subdomain.conf` snippet in docs when publishing the CA app.

Sample SWAG config (subdomain-style):

```nginx
server {
  listen 443 ssl;
  listen [::]:443 ssl;
  server_name unifiedledger.*;

  include /config/nginx/ssl.conf;

  location / {
    include /config/nginx/proxy.conf;
    include /config/nginx/resolver.conf;

    set $upstream_app unifiedledger;
    set $upstream_port 3000;
    set $upstream_proto http;
    proxy_pass $upstream_proto://$upstream_app:$upstream_port;

    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;

    # Websockets (safe even if unused)
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
  }
}
```

### Traefik support (labels users)

Traefik “support” means documenting required labels and middleware so the app sees correct headers and HTTPS:

- Route host rule: `Host(\`unifiedledger.example.com\`)`
- Service port: `3000`
- TLS enabled (cert resolver)
- Ensure forwarded headers are present (Traefik typically sets these by default)

Provide a minimal labels example in docs (v2/v3 depending on user base).

Minimal Traefik labels example (v2):

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.unifiedledger.rule=Host(`unifiedledger.example.com`)"
  - "traefik.http.routers.unifiedledger.entrypoints=websecure"
  - "traefik.http.routers.unifiedledger.tls=true"
  - "traefik.http.routers.unifiedledger.tls.certresolver=letsencrypt"
  - "traefik.http.services.unifiedledger.loadbalancer.server.port=3000"
  # Traefik already sets forwarded headers by default; only add header middleware if troubleshooting.
```

### Websocket / SSE

If you add realtime features later, ensure the proxy supports websockets. (Not currently required by this plan.)

---

## Uploads Persistence (required)

Users expect uploaded files to persist across container updates. Standardize uploads to `/config/uploads` and ensure the app:

- Writes uploads to `/config/uploads`
- **Serves downloads via authenticated endpoints** (not public static URLs)
- Does not store uploads only inside the container filesystem (`/app/public/uploads`) in production

CA template already mounts `/config`; no additional mounts should be required.

### Authenticated downloads (recommended)

Instead of linking directly to `/uploads/...` as a public static path, route access through a Next.js API endpoint that:

- Requires Better Auth session
- Validates ownership/authorization (user/household scope)
- Streams the file from `/config/uploads/...`
- Sets safe headers (`Content-Type`, `Content-Disposition`, `Cache-Control`)

This prevents leaking private user data through a guessable URL.

### Future-proofing for attachments/documents (recommended now)

To support receipts, invoices, and arbitrary documents later, treat “uploads” as a first-class domain concept rather than a special-case avatar file.

Recommended infrastructure:

- **Storage root**: `UPLOADS_DIR=/config/uploads` (default in production)
- **Filesystem layout** (example):
  - `/config/uploads/avatars/<userId>.<ext>`
  - `/config/uploads/attachments/<householdId>/<attachmentId>/<originalFilename>`
- **DB metadata table** (recommended):
  - `attachments`: id, householdId, ownerUserId, originalFilename, mimeType, sizeBytes, sha256, createdAt, storagePath
  - `attachmentLinks`: attachmentId, entityType (transaction|bill|goal|...), entityId
- **Upload API**:
  - `POST /api/uploads` (multipart)
  - Auth required; validate household membership
  - Validate content type + size limits; compute hash for dedupe/integrity
- **Download API**:
  - `GET /api/uploads/:id` returns file stream
  - Auth required; authorize by household membership + link/ownership rules
  - Support `Range` requests for large files (optional but recommended)
- **Security**:
  - Do not trust user-provided filenames for paths
  - Consider optional malware scanning hooks (future)
  - Set `Content-Disposition: attachment` for documents by default

This structure keeps data private, supports household sharing, and survives container updates cleanly.

---

## Optional Postgres: Supported version

Minimum supported Postgres version: **17+** (officially supported).

---

## Implementation Summary

All core infrastructure is complete:

1. ✅ Dual DB support in `lib/db/index.ts` + `lib/db/dialect.ts`
2. ✅ Better Auth provider switching in `lib/better-auth.ts`
3. ✅ Split Drizzle migration configs (`drizzle.config.sqlite.ts` + `drizzle.config.pg.ts`)
4. ✅ Startup auto-migration runner with locking (`scripts/docker-entrypoint.mjs`)
5. ⏳ Publish images to GHCR with semantic tags (CI/CD setup)
6. ⏳ Submit CA template (or provide it for CA maintainers)


