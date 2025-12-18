# Unified Ledger

A mobile-first, self-hosted personal finance application that puts you in complete control of your financial data.

## What is Unified Ledger?

Unified Ledger is a comprehensive personal finance management platform designed for privacy-conscious individuals and families who want to track their finances without relying on cloud services. Built to run as a single container on home servers like Unraid, it provides enterprise-grade financial tracking with complete data ownership.

### Key Features

**Core Financial Management**
- **Transaction Tracking**: Log income and expenses with smart categorization, audit trails, and modification history
- **Multi-Account Support**: Manage checking, savings, credit cards, loans, and custom account types in one place
- **Bills Management**: Track recurring and non-monthly bills with due date reminders, payment history, and annual planning
- **Debt Payoff**: Unified debt tracking with snowball/avalanche strategies, extra payment tracking, and payoff countdowns

**Budgeting & Goals**
- **Budget Management**: Set and track budgets by category with adherence scoring and surplus tracking
- **Savings Goals**: Track progress toward financial goals with milestone management and contribution tracking
- **Financial Planning**: Long-term goal setting with visual progress tracking

**Tax & Business Features**
- **Tax Deduction Tracking**: Mark transactions as tax-deductible with business vs. personal categorization
- **Sales Tax Management**: Multi-level tax rate support (state, county, city) with quarterly estimated payments
- **Tax Dashboard**: PDF export for accountant-ready reporting

**Integrations**
- **Google Calendar Sync**: Sync bill due dates, savings milestones, and debt milestones
- **TickTick Integration**: Sync financial obligations as tasks
- **CSV Import**: Import financial data with reusable templates

**Household Collaboration**
- **Multi-User Support**: Invite family members to shared household accounts
- **Role-Based Permissions**: Granular access control for different household members
- **Complete Data Isolation**: Your financial data stays separate from other households

**Security & Privacy**
- **Self-Hosted**: Your data never leaves your server
- **Two-Factor Authentication**: TOTP-based 2FA with backup codes
- **OAuth Support**: Optional Google and GitHub sign-in
- **Session Management**: Secure session handling with timeout enforcement

**Mobile & Offline**
- **Mobile-First Design**: Optimized for smartphones with responsive UI
- **PWA Support**: Install as an app on your phone or tablet
- **Offline Mode**: Queue transactions offline and sync when connected

## Who is Unified Ledger For?

**Privacy-Conscious Individuals**: If you want complete ownership of your financial data without trusting third-party cloud services, Unified Ledger keeps everything on your own hardware.

**Home Lab Enthusiasts**: Designed specifically for self-hosters running Unraid, TrueNAS, or Docker environments. One container, persistent storage, automatic migrations.

**Families & Households**: Multi-user support with role-based permissions makes it easy for couples and families to manage shared finances together while maintaining appropriate access controls.

**Small Business Owners**: Tax deduction tracking, business expense categorization, and PDF exports make tax time easier for freelancers and small business operators.

**Budget-Focused Users**: If you want to move beyond spreadsheets with features like debt payoff strategies, savings goal tracking, and spending analysis, Unified Ledger provides the structure you need.

## Technology

Built with Next.js (App Router), Drizzle ORM, SQLite (default) or PostgreSQL, and Better Auth.

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
