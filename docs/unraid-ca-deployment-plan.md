# Unified Ledger - Unraid Community Apps Deployment Plan (SQLite default + Optional Postgres)

This plan describes how to publish Unified Ledger as an **Unraid Community Apps (CA)** container with:

- **Default DB**: SQLite, persisted under `/config`
- **Optional DB**: Postgres (users provide a full `DATABASE_URL`)
- **1-click updates**: Unraid pulls a new image and the container **auto-runs non-interactive migrations on startup**

---

## Goals & Constraints

- **Single-container CA app**: Unraid CA templates are best when a single container provides the app (DB can be external/optional).
- **Persistent data**: DB and durable files must live under `/config` (mapped to Unraid appdata).
- **Unattended upgrades**: DB migrations must be **non-interactive**, **repeatable**, and **safe**.
- **Two DB backends**: SQLite and Postgres have different SQL dialects, so migration artifacts must be separated.

---

## Decisions to Make (before implementation)

These are the remaining “fork in the road” items where we should pick one approach and then implement consistently.

### 0) Migration strategy for CA upgrades (choose ONE)

Unified Ledger currently uses a Docker “migrator” pattern with `drizzle-kit push` (schema sync) in a one-shot container/step. For Unraid CA, we must decide what’s acceptable for unattended upgrades:

- **Option A — Keep `drizzle-kit push` (schema sync)**
  - **Pros**: Matches current repo Docker approach; no migration files to manage.
  - **Cons**: Can become ambiguous for destructive changes; may prompt in edge cases; less auditable/reviewable.
  - **Decision required**: Are we willing to constrain schema evolution to changes that never require interactive resolution at runtime?

- **Option B — Move to committed migrations + `drizzle-kit migrate`**
  - **Pros**: Deterministic, auditable, safer for upgrades; aligns with “unattended upgrades” requirement.
  - **Cons**: Requires generating + committing migrations; must maintain *dialect-specific* outputs for SQLite vs Postgres.
  - **Decision required**: Are we willing to change the project’s DB workflow to migration-based for production images?

If we pick **Option B**, Step 2 below is the correct direction. If we pick **Option A**, Step 2 should be rewritten to explicitly codify the “push-only” constraints and how to avoid interactive prompts.

**Decision (chosen): Option B — committed migrations + `drizzle-kit migrate` for CA.**

### 1) Where should production data live inside the container?

For CA, the contract is `/config`. The app currently defaults to `/app/data/finance.db` in production when `DATABASE_URL` is not set.

- **Decision required**: Standardize on:
  - SQLite default: `DATABASE_URL=file:/config/finance.db`
  - Uploads root: `/config/uploads`
  - Optional backups/exports: `/config/backups`

This implies updating any Docker docs/examples that mention `/app/data` to `/config` for CA.

**Decision (chosen): Standardize on `/config` for CA (DB at `/config/finance.db`, uploads at `/config/uploads`).**

### 2) Single-container “entrypoint migrates then starts” vs separate migrator step

Unraid CA templates typically run **one container**. There are two common approaches:

- **Option A — Single container entrypoint runs migrations then starts server**
  - **Recommended for CA**: Easiest “1-click update” UX.
- **Option B — Separate migrator container/job**
  - Works in Compose, but is a worse fit for CA’s single-app template model.

**Decision required**: Implement Option A for CA even if local docker-compose keeps Option B.

**Decision (chosen): Option A — single container entrypoint migrates then starts the app.**

### 3) Postgres scope (supported vs “best effort”)

- **Decision required**:
  - Is Postgres officially supported (CI coverage + migrations), or “advanced/experimental”?
  - Minimum supported Postgres version (e.g. 15+ or 16+).

**Decision (chosen): Postgres is officially supported; minimum Postgres version is 17+.**

### 4) Reverse proxy / cookie security defaults

Better Auth cookies and redirects depend on the public URL and secure-cookie policy.

- **Decision required**:
  - Is `FORCE_SECURE_COOKIES=true` the default in CA templates?
  - Do we document required reverse proxy headers (`Host`, `X-Forwarded-Proto`) as “musts”?

**Decision (chosen): `FORCE_SECURE_COOKIES` defaults to false; rely on `NEXT_PUBLIC_APP_URL` and forwarded headers to enable Secure cookies when appropriate.**

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
  - If unset/false, cookies should be marked Secure automatically when `NEXT_PUBLIC_APP_URL` starts with `https://` (and/or when proxy forwarded headers indicate HTTPS).
  - Set to `true` only if you need to force Secure cookies regardless of URL/headers (generally not recommended unless you know why).

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

## Step 1 — Make the app truly DB-agnostic (SQLite + Postgres)

### 1.1 Database connection selection (Drizzle)

Update `lib/db/index.ts` to:

- Detect DB type from `DATABASE_URL`:
  - `postgres://` or `postgresql://` → Postgres driver
  - `file:` or a filesystem path → SQLite driver
- Export `db` and `sqlite/pg client` consistently for the rest of the app.

**SQLite behavior**
- Use `better-sqlite3` + `drizzle-orm/better-sqlite3`
- Default production path should be `/config/finance.db` (when `DATABASE_URL` is not set) for CA images/templates.

**Postgres behavior**
- Add deps: `pg` (+ `@types/pg`)
- Use `drizzle-orm/node-postgres` and `pg.Pool`
- Pool config comes from `DATABASE_URL` directly (Option A).

### 1.2 Better Auth adapter provider switch

Update `lib/better-auth.ts` so the drizzle adapter provider matches the DB:

- SQLite → `provider: "sqlite"`
- Postgres → `provider: "postgresql"` (confirm exact string Better Auth expects for Drizzle adapter)

### 1.3 Ensure schema compatibility across dialects

Because SQLite and Postgres differ, audit `lib/db/schema.ts` for:

- JSON storage strategy (SQLite often uses `text` with JSON encoding)
- Default values and booleans
- Index and constraint differences
- Any raw SQL fragments that are dialect-specific

---

## Step 2 — Migrations that work for both SQLite and Postgres (non-interactive)

### 2.1 Commit migrations; do not rely on “push” at runtime

For unattended upgrades, prefer **`drizzle-kit migrate`** with committed migration files.

`drizzle-kit push` can be ambiguous and may become interactive for certain schema changes; that’s not acceptable for CA updates.

This plan **chooses migration-based upgrades** for CA (see Decisions above).

### 2.2 Split migration outputs by dialect

Create two Drizzle configs:

- `drizzle.config.sqlite.ts`
  - `dialect: "sqlite"`
  - `out: "./drizzle/sqlite"`
- `drizzle.config.pg.ts`
  - `dialect: "postgresql"`
  - `out: "./drizzle/postgres"`

### 2.3 Migration generation workflow (developer/CI)

When changing schema:

- Generate SQLite migrations:
  - `pnpm drizzle-kit generate --config drizzle.config.sqlite.ts`
- Generate Postgres migrations:
  - `pnpm drizzle-kit generate --config drizzle.config.pg.ts`

Commit both outputs.

### 2.4 Startup auto-migration runner (required for 1-click updates)

Add a startup script (recommended path: `scripts/docker-entrypoint.mjs`) that:

1. Reads `DATABASE_URL`
2. Chooses dialect:
   - Postgres if `DATABASE_URL` starts with `postgres://` or `postgresql://`
   - Otherwise SQLite
3. Runs migrations using the correct config:
   - SQLite: `pnpm drizzle-kit migrate --config drizzle.config.sqlite.ts`
   - Postgres: `pnpm drizzle-kit migrate --config drizzle.config.pg.ts`
4. Starts the server (`node server.js`)

**Behavior requirements**

- Must be **non-interactive**
- Must exit non-zero on migration failure (Unraid will show container unhealthy)
- Must log:
  - DB type selected
  - migration start/finish
  - failure reason

### 2.5 Prevent concurrent migrations (recommended)

Even on Unraid, users can click “update” rapidly or restart loops can happen.

- **SQLite**: use a simple file lock in `/config` (e.g. `/config/.migrate.lock`) to ensure only one migrator runs at a time.
- **Postgres**: use an advisory lock (e.g. `pg_advisory_lock`) during migration.

---

## Step 3 — Docker image design for CA

### 3.1 Single image supports both DB modes

Publish a single image that can:

- run Next.js standalone
- run migrations on startup for either dialect

### 3.2 Practical build options

#### Option 1 (fastest): include drizzle-kit in runtime image

- Pros: easy to implement auto-migrate with `drizzle-kit migrate`
- Cons: larger image (includes tooling)

#### Option 2 (best long-term): custom lightweight migration runner

- Execute SQL migrations directly with:
  - `better-sqlite3` for SQLite
  - `pg` for Postgres
- Pros: smaller image, more control
- Cons: more code to maintain

Start with Option 1 to ship quickly; optimize later if desired.

### 3.3 Persistence expectation

- Always document and default to:
  - `/config` mount
  - `DATABASE_URL=file:/config/finance.db` (SQLite default)

### 3.4 Healthcheck / readiness contract (recommended)

The existing Dockerfile uses `GET /api/health` to determine container health.

**Decision (chosen): `/api/health` should validate DB connectivity** and return non-200 if the DB is unavailable/misconfigured (so Unraid surfaces broken configs quickly).

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

## Step 5 — CA Template (Option A: user provides full Postgres DATABASE_URL)

This template defaults to SQLite but supports Postgres by letting the user change `DATABASE_URL`.

> Implementation alignment note: the current repo Docker examples default to storing SQLite at `/app/data/finance.db`. For CA, we should standardize on `/config/finance.db` and ensure the image/entrypoint respects that default when `DATABASE_URL` is not provided.

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
Optional DB: Postgres via DATABASE_URL (install Postgres separately in Unraid CA)

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
          Description="Advanced. If false, Secure cookies should be enabled automatically when NEXT_PUBLIC_APP_URL is https (and/or proxy forwarded headers indicate https). Set true only if you need to force Secure cookies."
          Type="Variable" Display="advanced" Required="false"/>

  <!-- Database selection -->
  <Config Name="DATABASE_URL (SQLite default, Postgres optional)" Target="DATABASE_URL" Default="file:/config/finance.db" Mode="rw"
          Description="SQLite: file:/config/finance.db  |  Postgres: postgresql://user:pass@host:5432/unifiedledger"
          Type="Variable" Display="always" Required="true"/>

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

## Additional items to add (recommended)

### A) Add a CA-friendly Docker runtime contract section

Document runtime env vars that are helpful in Unraid deployments:

- `PORT=3000`
- `HOSTNAME=0.0.0.0`
- `NODE_ENV=production`
- `NEXT_TELEMETRY_DISABLED=1`

### B) Clarify uploads + avatars implementation details

This plan recommends `/config/uploads`. To make this actionable:

- **Decision required**: Do we introduce `UPLOADS_DIR` env var (default `/config/uploads`)?
- Confirm whether avatars are currently stored under `public/uploads` or filesystem outside Next static assets.
- Document size limits + allowed mime types for avatar uploads and any future attachments.

### C) First-run initialization (what happens on an empty DB?)

For CA, we should explicitly define:

- Does the app auto-create required tables on first run (via migrations/push)?
- Is there any seed step required for “first household”, categories, etc., or is onboarding entirely user-driven?

### D) Backup/restore guidance (minimum viable)

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
- If you terminate TLS at the proxy, ensure the upstream container still sees correct forwarded headers (commonly `X-Forwarded-Proto: https`).

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

### SWAG support (nginx config users)

SWAG is also nginx, but config-file oriented. The key support requirements are the same:

- Forward `Host`
- Set `X-Forwarded-Proto` to `https`
- Proxy to the app container on port `3000`

Provide a sample `proxy-confs/unifiedledger.subdomain.conf` snippet in docs when publishing the CA app.

### Traefik support (labels users)

Traefik “support” means documenting required labels and middleware so the app sees correct headers and HTTPS:

- Route host rule: `Host(\`unifiedledger.example.com\`)`
- Service port: `3000`
- TLS enabled (cert resolver)
- Ensure forwarded headers are present (Traefik typically sets these by default)

Provide a minimal labels example in docs (v2/v3 depending on user base).

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

## Execution Order (recommended)

1. Implement dual DB support in `lib/db/index.ts`
2. Implement Better Auth provider switching in `lib/better-auth.ts`
3. Introduce split Drizzle migration configs + generation workflow
4. Add startup auto-migration runner (non-interactive)
5. Publish images to GHCR with semantic tags
6. Submit CA template (or provide it for CA maintainers)


