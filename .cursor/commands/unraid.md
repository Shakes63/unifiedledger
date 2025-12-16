Review docs/unraid-ca-deployment-plan.md and implement the next unfinished step(s) until the context window is nearly full or the plan is fully implemented.
Treat docs/unraid-ca-deployment-plan.md as the source of truth; keep decisions consistent with what’s written there (migrations via drizzle-kit migrate, single-container entrypoint, /config persistence, Postgres officially supported 17+, /api/health checks DB, FORCE_SECURE_COOKIES defaults false).

Before coding:
Write docs/unraid-ca-deployment-implementation-plan.md with:
- concrete file-level changes (Dockerfile/entrypoint/scripts, drizzle configs, DB adapter switch, Better Auth provider switch)
- non-interactive upgrade behavior and failure modes
- SQLite vs Postgres differences + how migrations are selected
- reverse proxy requirements (NEXT_PUBLIC_APP_URL, forwarded headers)
- data persistence contract (/config/finance.db, /config/uploads) + backup/restore notes

Then implement the first task from the plan.
Update docs/unraid-ca-deployment-plan.md as you learn things during implementation so it stays accurate.
Add/adjust README sections needed for Unraid users (env vars, ports, first-run behavior, upgrades).
Prefer strict TypeScript (no any), follow existing architecture patterns, and don’t hardcode secrets.
Commit and push changes as you go (or at least at the end if time is tight).
