# TickTick Calendar Sync — Test Coverage Plan

## Goal
Add automated coverage for **TickTick Calendar Sync** focusing on:
- API route behavior (validation, auth, status codes, response shape)
- OAuth connect/callback behavior (state handling, token exchange, DB upsert)
- Project selection flows (list/select/create project)
- Minimal mocking consistent with existing `__tests__/api/*` patterns

## Unified Architecture Check (Feature #58)
This work is **calendar sync test coverage** and does **not** change unified debts/bills/credit-card architecture.

## Current Implementation Map (entry points)
- **OAuth connect**
  - `app/api/calendar-sync/ticktick/connect/route.ts` (GET)
- **OAuth callback**
  - `app/api/calendar-sync/ticktick/callback/route.ts` (GET, redirects)
- **Project management**
  - `app/api/calendar-sync/projects/route.ts` (GET/POST) — TickTick only
- **Shared sync surface**
  - `app/api/calendar-sync/settings/route.ts` (already covered)
  - `app/api/calendar-sync/sync/route.ts` (already covered)
- **Core services**
  - `lib/calendar/ticktick-calendar.ts`
  - `lib/calendar/sync-service.ts` (already partially covered)

## Testing Strategy
### Phase 1 — API route unit tests (fast, deterministic)
#### 1) `GET /api/calendar-sync/ticktick/connect`
File: `__tests__/api/calendar-sync-ticktick-connect.test.ts`
- **400** when `householdId` missing
- **401** when unauthenticated (`requireAuth` throws `Unauthorized`)
- **503** when not configured (`isTickTickConfigured()` false)
- **200** returns `{ authUrl }` when configured
  - verify it calls `getTickTickAuthUrl(state)` with a generated state
  - verify it writes the `ticktick_oauth_state` cookie (mock `next/headers`)

#### 2) `GET/POST /api/calendar-sync/projects`
File: `__tests__/api/calendar-sync-ticktick-projects.test.ts`
- **GET**
  - **400** missing `connectionId`
  - **401** unauthorized
  - **404** connection not found (ownership/provider check)
  - **200** returns `{ projects, selectedProjectId }`
- **POST**
  - **400** missing `connectionId`
  - **400** when neither `projectId` nor `createNew`
  - **404** connection not found
  - **404** project not found (when selecting invalid `projectId`)
  - **200** select existing project updates connection
  - **200** create project (`createNew=true`) updates connection

### Phase 2 — Callback route tests (redirect-heavy)
File: `__tests__/api/calendar-sync-ticktick-callback.test.ts`
Mock `next/navigation` `redirect()` to capture redirect URL.
Mock `next/headers` cookies (get/set/delete) for state.

Cases:
- Redirects to settings with `calendarError` when:
  - `error` param present
  - missing `code`/`state`
  - missing state cookie / expired
  - state mismatch
- Happy path:
  - exchanges code for tokens
  - upserts `calendar_connections` for ticktick
  - creates default `calendar_sync_settings` if missing
  - attempts project selection (list → choose “Unified Ledger” → else create → else fallback to first)
  - redirects to settings with `calendarConnected=ticktick`

**Status:** ✅ Implemented (`__tests__/api/calendar-sync-ticktick-callback.test.ts`)

### Phase 3 — Service/unit coverage (optional)
If more depth needed:
- Add unit tests around `lib/calendar/ticktick-calendar.ts` pure helpers (e.g. reminder formatting) and token refresh branching
- Add `sync-service` tests that exercise TickTick create/update/delete paths with tracked events

**Status:** ✅ Implemented (sync-service TickTick paths)
- Extended `__tests__/lib/calendar/sync-service.test.ts` to cover TickTick provider dispatch (full sync delete batching, incremental create/update/delete + update fallback) and `isSyncEnabled`.

**Optional expansion complete:**
- ✅ Added `__tests__/lib/calendar/ticktick-calendar.test.ts` covering:
  - `isTickTickConfigured()` env-based config detection
  - `getValidTickTickAccessToken()` refresh + edge cases (missing connection, missing refresh token)
  - `createTickTickTask()` request body contract including reminder formatting

## First Task to Implement (do this immediately)
Next optional expansion:
- Add provider API error contract tests for TickTick task/project endpoints (non-200 responses) and additional token refresh failure modes.

## Definition of Done
- New tests pass under `pnpm test`
- API tests follow existing mocking patterns and use no `any` except in test-only mocking contexts
- `docs/features.md` updated to reference this plan and reflect progress
- `docs/manual-testing-checklist.md` updated to note added automated TickTick API tests


