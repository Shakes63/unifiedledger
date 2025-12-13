# Google Calendar Sync — Test Coverage Plan

## Goal
Add dedicated automated test coverage for **Google Calendar Sync** (and the shared calendar-sync surface area it depends on) with a focus on:
- API route behavior (validation, auth, status codes, response shape)
- Provider “status/enable” flows (configured vs linked vs error states)
- Minimal mocking required, consistent with existing `__tests__/api/*` patterns

This plan starts with **high-value, low-friction API route tests** (pure function handlers with mocked dependencies), then expands into deeper service/unit coverage as needed.

## Unified Architecture Check (Feature #58)
- The prompt references `docs/unified-debt-bill-credit-card-architecture.md`, but that file **does not exist in this repo** at the moment.
- This task is **calendar sync test coverage**, not debts/bills/credit cards/categories/budgets architecture work, so it’s **not part of Feature #58’s unified architecture phases**.
- Action: proceed without unified-architecture updates; if the missing doc is reintroduced later, no conflict.

## Current Implementation Map (entry points)
- **Google status / enable**
  - `app/api/calendar-sync/google/status/route.ts`
  - `app/api/calendar-sync/google/enable/route.ts`
  - Deprecated endpoints:
    - `app/api/calendar-sync/google/connect/route.ts` (410)
    - `app/api/calendar-sync/google/callback/route.ts` (redirect)
- **Shared sync**
  - `app/api/calendar-sync/settings/route.ts`
  - `app/api/calendar-sync/sync/route.ts`
- **Core services**
  - `lib/calendar/google-calendar.ts`
  - `lib/calendar/sync-service.ts`

## Testing Strategy
### Phase 1 — API route unit tests (fast, deterministic)
Write `__tests__/api/calendar-sync-google-status.test.ts` to cover `GET /api/calendar-sync/google/status`:
- **400** when `householdId` missing
- **401** when unauthenticated (`requireAuth` throws `Unauthorized`)
- **200** “not configured” response when `isGoogleCalendarConfigured()` false
- **200** “not linked” response when configured but `hasGoogleOAuthLinked()` false
- **200** “linked” response includes:
  - calendars returned from `listCalendarsForUser()`
  - selected calendar fields from `calendarConnections` row
  - settings from `calendarSyncSettings` row
- **200** “linked but calendar list error” sets `error` string and returns empty `calendars`

Mocking approach:
- `vi.mock('@/lib/auth-helpers', ...)` for `requireAuth`
- `vi.mock('@/lib/db', ...)` for `db.select()` chains
- `vi.mock('@/lib/calendar/google-calendar', ...)` for the Google helpers

**Status:** ✅ Implemented (`__tests__/api/calendar-sync-google-status.test.ts`)

### Phase 2 — Google enable endpoint tests
Write `__tests__/api/calendar-sync-google-enable.test.ts` to cover `POST /api/calendar-sync/google/enable`:
- **400** missing `householdId`
- **503** when not configured
- **400** when not linked
- Creates new `calendarConnections` row when none exists
- Updates existing row when present (clears legacy token fields)
- Creates default `calendarSyncSettings` row when missing
- Calendar selection:
  - picks primary (or first) calendar if no `calendarId` provided
  - resolves `calendarName` when `calendarId` provided
 - Calendar lookup failures:
   - list call errors should not crash enable (calendarId/calendarName may be null)

### Phase 3 — Shared routes (`settings`, `sync`)
Add tests for:
- `GET/PUT /api/calendar-sync/settings`
- `POST /api/calendar-sync/sync`
Focus: required params, validation and error status codes (`400`, `401`, `207`), and response shapes.

### Phase 4 — Service/unit coverage (optional expansion)
If coverage still feels thin after route tests:
- Extract pure helpers from `lib/calendar/google-calendar.ts` (e.g., event payload builder) and unit test them
- Add focused tests around `lib/calendar/sync-service.ts` branching logic (e.g., `syncEntity` early exits) using DB mocks

## First Task to Implement (do this immediately)
Implement **Phase 2**: `__tests__/api/calendar-sync-google-enable.test.ts` with the full set of cases above.

## Definition of Done
- New API tests pass under `pnpm test`
- Tests follow existing repo patterns (Vitest + route-handler imports + module mocks)
- `docs/features.md` updated to reference this plan under the “Testing Backlog” entry
- `docs/manual-testing-checklist.md` updated (add a line noting API contract validation coverage for calendar sync)
- `.cursor/rules/*.mdc` updated to reflect the docs hygiene rules from `docs/prompts.txt`


