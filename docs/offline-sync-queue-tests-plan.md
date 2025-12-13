## Offline Sync Queue — Test Coverage Plan

### Goal
Add automated test coverage for the **offline transaction queue + sync flow**, including:
- Queuing transactions while offline
- Syncing pending transactions when online
- Retry logic + max-attempt behavior
- Error status tracking, and retrying failed syncs

This corresponds to the “Offline Sync Queue” backlog item in `docs/features.md`.

---

## Where the Code Lives

### Core queue (IndexedDB)
- `lib/offline/transaction-queue.ts`
  - `offlineTransactionQueue.addTransaction()`
  - `getPendingTransactions()`, `getPendingCount()`
  - status transitions: `markAsSyncing`, `markAsSynced`, `markSyncError`, `updateTransactionStatus`

### Sync manager (orchestration)
- `lib/offline/offline-sync.ts`
  - `syncPendingTransactions(userId)`
  - `autoSync(userId)`
  - `retrySyncErrors(userId)`
  - `getSyncStatus(userId)`
  - `discardOfflineTransaction(offlineId)`

### Client hook integration
- `hooks/useOfflineTransaction.ts`
  - Uses Better Auth session + `useOnlineStatus()`
  - Online → POST `/api/transactions`
  - Offline → write to `offlineTransactionQueue` and return `{ offline: true }`

---

## Testing Strategy

### Phase 1 — Offline sync manager unit tests (fast, deterministic)
File: `__tests__/lib/offline/offline-sync.test.ts`

Mock the IndexedDB layer via mocking `offlineTransactionQueue` methods (do not exercise IndexedDB internals in this phase).

Coverage:
- **`syncPendingTransactions`**
  - Returns zeros when no pending
  - Sequentially syncs multiple pending transactions
  - Uses max attempts gate (skips those with `attempts >= MAX_SYNC_ATTEMPTS`)
  - `fetch` success: calls `markAsSyncing`, then `markAsSynced` with returned transaction ID
  - `fetch` failure (`!ok` or throw/timeout): calls `markSyncError` with incremented attempts + error message
  - Ensures a small delay between syncs (use fake timers)
- **`autoSync`**
  - Returns successful summary from `syncPendingTransactions`
  - Returns safe empty summary if unexpected error thrown
- **`getSyncStatus`**
  - Correctly counts statuses from `getAllTransactions`
- **`retrySyncErrors`**
  - Resets errored transactions to pending (attempts reset) and retries
  - Ensures attempt increment logic is correct after reset (guard against “double counting” bug)
- **`discardOfflineTransaction`**
  - Calls `deleteTransaction`

### Phase 2 — Hook tests for offline submission
File: `__tests__/hooks/useOfflineTransaction.test.tsx`

Mock:
- `betterAuthClient.useSession()`
- `useOnlineStatus()`
- `offlineTransactionQueue.addTransaction()`

Coverage:
- Online path posts to `/api/transactions` and returns server JSON
- Offline path queues transaction and returns `{ offline: true, id }`
- Throws if no session user

### Phase 3 — IndexedDB queue behaviors (optional / deeper)
File: `__tests__/lib/offline/transaction-queue.test.ts`

If we want true IndexedDB coverage:
- Add a lightweight IndexedDB mock for tests (or add `fake-indexeddb` as a dev dependency)
- Cover `addTransaction`, `getPendingTransactions`, `updateTransactionStatus`, deletion, and indexing behavior.

---

## First Task to Implement
Implement **Phase 1**: `__tests__/lib/offline/offline-sync.test.ts`.

---

## Definition of Done
- New tests passing under `pnpm test`
- `docs/features.md` updated to include status + plan link for Offline Sync Queue
- Commit and push changes

