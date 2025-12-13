## Admin User Management — Test Coverage Plan

### Goal
Add automated tests for the **Admin User Management** subsystem:
- `/api/admin/users` (GET list, POST create)
- `/api/admin/users/[userId]` (PUT update, DELETE delete)
- Ownership gating via `requireOwner()` (`lib/auth/owner-helpers.ts`)

This corresponds to the “Admin User Management” item in `docs/features.md` (Testing Backlog).

---

## Key Code Locations
- **API**
  - `app/api/admin/users/route.ts`
  - `app/api/admin/users/[userId]/route.ts`
  - `app/api/admin/households/route.ts` (used by UI but secondary to this task)
  - `app/api/admin/check-owner/route.ts` (visibility gate)
- **Owner gate**
  - `lib/auth/owner-helpers.ts` (`requireOwner`, `getCurrentUserOwnerStatus`)
- **UI**
  - `components/settings/admin-users-tab.tsx`

---

## Testing Strategy

### Phase 1 — API route unit tests (primary)
Create `__tests__/api/admin-users.test.ts` using existing API test patterns:
- Mock `requireOwner` to control **401/403** behavior
- Mock `db` query chains (`select`, `insert`, `update`, `delete`)
- Mock `auth.api.signUpEmail` for create flow
- Mock `next/headers` `headers()` when route calls Better Auth API

#### `GET /api/admin/users`
Coverage:
- **401** when `requireOwner` throws `Unauthorized`
- **403** when `requireOwner` throws Forbidden
- **200** list response shape: `{ users, total, limit, offset }`
- **Search** path sets where clause (don’t assert SQL internals; assert it still returns expected shape)
- **Pagination** honors `limit`/`offset`
- **Household count**: ensures membership lookup per user is performed and `householdCount` appears

#### `POST /api/admin/users`
Coverage:
- **401/403** owner gating
- **400** missing email/password
- **400** invalid email format
- **400** password < 8
- **409** email already exists (db check)
- **404** household not found when `householdId` provided
- **400** invalid role when household provided
- **201** success returns `{ id, email, name, householdId, role, createdAt }`
  - If household provided → inserts `householdMembers` once
  - If already member → does not insert membership

### Phase 2 — Update/delete endpoint tests
Create `__tests__/api/admin-users-userId.test.ts`

#### `PUT /api/admin/users/[userId]`
Coverage:
- **401/403** gating
- **404** user not found
- **403** cannot modify application owner
- **400** invalid email format
- **409** email conflict
- **404** household not found
- **400** invalid role
- **200** success shape includes `message`

#### `DELETE /api/admin/users/[userId]`
Coverage:
- **401/403** gating
- **404** user not found
- **403** cannot delete application owner
- **200** success
  - Deletes memberships then deletes user

### Phase 3 — Optional UI tests
If we want UI coverage later:
- Basic render and fetch error handling for `AdminUsersTab`
- Debounced search behavior

---

## First Task to Implement
Implement **Phase 1**: `__tests__/api/admin-users.test.ts` (GET + POST).

---

## Definition of Done
- Tests pass under `pnpm test`
- `docs/features.md` updated with plan link + status
- Commit + push changes

