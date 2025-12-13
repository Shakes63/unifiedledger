# Backup System – Implementation Plan

## Goal
Close out the remaining Backup System backlog by adding automated coverage for:
- scheduled backups (cron)
- retention/cleanup
- restore/download flows
- permissions (user/household isolation)

## Plan

### 1) API contract tests (first task)
- `/api/cron/backups`:
  - cron secret validation
  - response shape includes created/failed counts

- `/api/user/backups`:
  - 401 when unauthorized
  - lists only the current user’s backups

- `/api/user/backups/[id]` + `/download`:
  - cannot access another user’s backup

### 2) Library unit tests
- `lib/backups/create-backup.ts`:
  - creates file + db record
- `lib/backups/backup-utils.ts`:
  - retention calculation

## Test Plan
- `pnpm test __tests__/api/*backup*.test.ts __tests__/lib/backups/*.test.ts`
