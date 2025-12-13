# Autopay System — Test Coverage Plan

## Goal
Add automated coverage for **Autopay** business logic and cron/API behavior:
- Amount calculation accuracy (Decimal-safe, edge cases)
- Transaction creation side effects (transfer vs expense, balance updates)
- Batch processing selection logic (dueDate - autopayDaysBefore)
- Cron endpoint security + response contracts

## Unified Architecture Check (Feature #58)
This is a **test coverage** task for an existing subsystem. No unified-architecture doc is available in this repo right now, so this plan proceeds without phase cross-references.

## Current Implementation Map
- **Amount calculation**: `lib/bills/autopay-calculator.ts`
- **Transaction creation**: `lib/bills/autopay-transaction.ts`
- **Batch processor**: `lib/bills/autopay-processor.ts`
- **Cron endpoint**: `app/api/cron/autopay/route.ts`
- **Notifications**: `lib/notifications/autopay-notifications.ts`

## Testing Strategy
### Phase 1 — Pure logic unit tests (fast)
File: `__tests__/lib/bills/autopay-calculator.test.ts`
- `calculateAutopayAmount`
  - fixed uses `autopayFixedAmount` else expected
  - minimum/statement/full use linked account values when present, else fallback to remaining
  - statement/full use abs() for balances
  - partial payments respect `remainingAmount` / `paidAmount`
  - amount <= 0 returns “Nothing Owed” with no insufficientFunds
  - insufficientFunds toggles correctly
- `getAutopayDescription` formatting
- `validateAutopayConfiguration` errors (missing autopayAccountId, invalid fixed amount)

### Phase 2 — Cron route contract tests
File: `__tests__/api/cron-autopay.test.ts`
- `POST /api/cron/autopay`
  - returns 401 when CRON secret is set and missing/invalid
  - returns 200 when secret matches and includes expected response shape
  - returns 500 when processor throws
- `GET /api/cron/autopay`
  - returns preview response shape and maps non-sensitive fields only

### Status
- ✅ **Phase 1 complete**: `__tests__/lib/bills/autopay-calculator.test.ts`
- ✅ **Phase 2 complete**: `__tests__/api/cron-autopay.test.ts`

### Phase 3 — Processor selection logic
File: `__tests__/lib/bills/autopay-processor.test.ts`
- instance eligibility filtering across:
  - autopayDaysBefore offsets
  - pending vs overdue statuses
  - missing autopayAccountId → skipped
  - success vs failure counters
  - notification dispatch paths
  - thrown error handling → SYSTEM_ERROR

### Phase 4 — Transaction creator integration
File: `__tests__/lib/bills/autopay-transaction.test.ts`
- transfer vs expense branches
- balance updates
- handles insufficient funds / already paid / invalid config
- processBillPayment error handling

### Phase 5 — Notifications helpers
File: `__tests__/lib/notifications/autopay-notifications.test.ts`
- success notification suppressed for zero-amount
- failure message includes mapped reason + amount when present
- summary formatting

## First Task to Implement (do this immediately)
Implement **Phase 3**: `__tests__/lib/bills/autopay-processor.test.ts`.

## Definition of Done
- New tests pass under `pnpm test`
- Follow existing repo mocking patterns (no servers; mock DB where needed)
- Update `docs/features.md` to link this plan under the Autopay backlog item
- Update `docs/manual-testing-checklist.md` to note new automated coverage


