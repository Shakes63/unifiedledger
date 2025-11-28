# Linter Cleanup - Remaining Directories Implementation Plan

**Created:** 2025-11-28
**Status:** In Progress
**Priority:** Low

## Overview

This plan addresses the remaining ESLint issues in `__tests__/`, `scripts/`, `contexts/`, and `hooks/` directories.

## Current Status

| Metric | Count |
|--------|-------|
| Total Problems | 73 |
| Errors | 17 |
| Warnings | 56 |

## Issues by Category

### Category 1: `@typescript-eslint/no-explicit-any` Errors (17 total)

These require proper TypeScript types instead of `any`.

| File | Line(s) | Issue |
|------|---------|-------|
| `__tests__/integration/middleware-session-redirect.test.ts` | 26, 35, 39, 47, 62, 82, 100, 111, 126 | 9 `any` types for mock request and process.env |
| `hooks/useOfflineTransaction.ts` | 19 | 1 `any` for `formData` parameter |
| `scripts/generate-test-data.ts` | 138 | 1 `any` in catch block |
| `scripts/migrate-clerk-to-better-auth.ts` | 75, 76, 92, 130, 149, 155, 170 | 7 `any` types for DB results and errors |

### Category 2: Unused Variables Warnings (48 total)

These require prefixing with `_` or removal.

| File | Variables to Fix |
|------|------------------|
| `__tests__/api/batch-splits.test.ts` | `beforeEach`, `afterEach` |
| `__tests__/api/household-member-permissions.test.ts` | `householdMembers`, `TEST_USER_ID_OWNER`, `TEST_USER_ID_MEMBER`, `TEST_USER_ID_NON_MEMBER` |
| `__tests__/integration/bulk-apply-rules.test.ts` | `rule1` |
| `__tests__/integration/rules-flow.test.ts` | `vi`, `and`, `testMerchantId`, 2x `rule` |
| `__tests__/integration/transaction-creation-rules.test.ts` | `generateTestUserId`, 3x `rule` |
| `__tests__/lib/household/permissions.test.ts` | `householdMembers`, `TEST_USER_ID_VIEWER` |
| `__tests__/lib/rules/actions-executor.test.ts` | `SplitConfig`, `categories`, `merchants`, `limitValue`, `expectMutations`, `expectAppliedAction` |
| `__tests__/lib/rules/rule-matcher.test.ts` | `RuleEvaluationResult`, `RuleMatch` |
| `hooks/useOneHandedMode.ts` | `useSyncExternalStore` |
| `scripts/call-backup-scheduler.mjs` | `readFileSync` |
| `scripts/generate-test-data.ts` | 8 unused imports, 2 `accountName` |
| `scripts/migrate-clerk-to-better-auth.ts` | 2 `error` in catch blocks |
| `scripts/test-backup-household-isolation.mjs` | `readFileSync`, `fetch`, `baseUrl` |
| `scripts/test-backup-isolation-direct.mjs` | `wrongBackups1`, `wrongBackups2` |
| `scripts/test-backup-scheduler-direct.mjs` | `readFileSync` |
| `scripts/test-backup-scheduler.mjs` | `readFileSync` |
| `scripts/test-debts-api-endpoints.mjs` | `getAuthToken`, `getCurrentHouseholdId` |
| `scripts/test-invited-onboarding.mjs` | 4 test functions |

### Category 3: React Hook Dependencies Warnings (2 total)

| File | Line | Issue |
|------|------|-------|
| `contexts/household-context.tsx` | 275 | Missing `refreshHouseholds` in useEffect deps |
| `contexts/onboarding-context.tsx` | 117 | Missing `isDemoMode` in useCallback deps |

### Category 4: Unused Caught Errors (3 total)

| File | Line | Issue |
|------|------|-------|
| `contexts/network-status-context.tsx` | 196 | `error` should be `_error` |
| `scripts/migrate-clerk-to-better-auth.ts` | 98, 155 | `error` should be `_error` |

---

## Implementation Plan

### Phase 1: Fix Errors (17 items) - Priority High

Errors must be fixed as they could indicate real issues.

#### Task 1.1: Fix `middleware-session-redirect.test.ts` (9 errors)

Create a proper mock request type interface:

```typescript
interface MockCookie {
  name: string;
  value: string;
}

interface MockRequest {
  url: string;
  nextUrl: { pathname: string };
  cookies: {
    get: (name: string) => MockCookie | undefined;
  };
}
```

- Line 26: Cast to `MockRequest` instead of `any`
- Line 35: Use `as unknown as NodeJS.ProcessEnv` for env typing
- Lines 39, 47, 62, 82, 100, 111, 126: Cast `validateSession` properly using `vi.mocked()`

#### Task 1.2: Fix `useOfflineTransaction.ts` (1 error)

Create a proper `TransactionFormData` interface:

```typescript
interface TransactionFormData {
  type: 'income' | 'expense' | 'transfer_out' | 'transfer_in';
  amount: string;
  description: string;
  date: string;
  accountId: string;
  categoryId?: string;
  merchantId?: string;
  notes?: string;
  [key: string]: unknown; // Allow additional fields
}
```

#### Task 1.3: Fix `generate-test-data.ts` (1 error)

Change line 138 from `error: any` to `error: unknown` and use type guard:

```typescript
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // ...
}
```

#### Task 1.4: Fix `migrate-clerk-to-better-auth.ts` (7 errors)

- Lines 75-76: Create interface for Better Auth user result
- Lines 92, 149: Create interface for SQL count result
- Lines 130, 155, 170: Use `error: unknown` with type guards

### Phase 2: Fix Warnings (56 items) - Priority Low

#### Task 2.1: Prefix Unused Variables with `_` 

For each unused variable, prefix with underscore:
- `beforeEach` → `_beforeEach`
- `rule1` → `_rule1`
- etc.

#### Task 2.2: Remove Unused Imports

For truly unused imports (not intentional exports), remove them entirely:
- `householdMembers` import in permissions tests
- `readFileSync` in various scripts
- `useSyncExternalStore` in hooks

#### Task 2.3: Fix React Hook Dependencies

**`household-context.tsx` (line 275):**
The `refreshHouseholds` function should NOT be in deps as it would cause infinite loops. The correct fix is to use `// eslint-disable-next-line react-hooks/exhaustive-deps` with a comment explaining why.

**`onboarding-context.tsx` (line 117):**
Add `isDemoMode` to the dependency array since it's used in the callback.

---

## File-by-File Changes

### `__tests__/api/batch-splits.test.ts`
- Line 6: Change `beforeEach, afterEach` to `_beforeEach, _afterEach`

### `__tests__/api/household-member-permissions.test.ts`
- Line 5: Remove unused `householdMembers` import
- Lines 49, 51, 53: Prefix test constants with `_`

### `__tests__/integration/bulk-apply-rules.test.ts`
- Line 448: Change `rule1` to `_rule1`

### `__tests__/integration/middleware-session-redirect.test.ts`
- Add `MockRequest` interface
- Update `createRequest` return type
- Use `vi.mocked()` for validateSession casts
- Fix process.env typing

### `__tests__/integration/rules-flow.test.ts`
- Line 18: Remove or prefix `vi`
- Line 28: Remove or prefix `and`
- Line 56: Prefix `testMerchantId` with `_`
- Lines 226, 729: Change `rule` to `_rule`

### `__tests__/integration/transaction-creation-rules.test.ts`
- Line 33: Prefix `generateTestUserId` with `_`
- Lines 223, 393, 492: Change `rule` to `_rule`

### `__tests__/lib/household/permissions.test.ts`
- Line 16: Remove unused `householdMembers` import
- Line 49: Prefix `TEST_USER_ID_VIEWER` with `_`

### `__tests__/lib/rules/actions-executor.test.ts`
- Line 15: Remove unused `SplitConfig` import
- Lines 125-126: Prefix `categories`, `merchants` with `_`
- Line 129: Change `limitValue` to `_limitValue`
- Lines 242, 255: Prefix helper functions with `_`

### `__tests__/lib/rules/rule-matcher.test.ts`
- Lines 12-13: Remove unused type imports

### `contexts/household-context.tsx`
- Line 275: Add `// eslint-disable-next-line react-hooks/exhaustive-deps` with comment

### `contexts/network-status-context.tsx`
- Line 196: Change `error` to `_error`

### `contexts/onboarding-context.tsx`
- Line 117: Add `isDemoMode` to dependency array

### `hooks/useOfflineTransaction.ts`
- Create `TransactionFormData` interface
- Line 19: Use `TransactionFormData` instead of `Record<string, any>`

### `hooks/useOneHandedMode.ts`
- Line 1: Remove unused `useSyncExternalStore` import

### `scripts/call-backup-scheduler.mjs`
- Line 10: Remove unused `readFileSync` import

### `scripts/generate-test-data.ts`
- Lines 49-56, 91, 95: Remove unused imports
- Line 138: Change `error: any` to `error: unknown`
- Lines 1058, 1484: Prefix `accountName` with `_`

### `scripts/migrate-clerk-to-better-auth.ts`
- Create interfaces for DB results
- Lines 75-76: Use proper interface
- Lines 92, 149: Use count result interface
- Lines 98, 130, 155, 170: Use `error: unknown` with type guards

### Various test scripts (.mjs files)
- Remove or prefix all unused imports and variables

---

## Testing Strategy

1. Run `pnpm eslint __tests__/ scripts/ contexts/ hooks/ --max-warnings=0` after each phase
2. Run `pnpm test` to ensure no test regressions
3. Run `pnpm build` to ensure no build errors

## Success Criteria

- [ ] 0 ESLint errors
- [ ] 0 ESLint warnings
- [ ] All tests pass
- [ ] Build succeeds

## Estimated Time

- Phase 1 (Errors): ~30 minutes
- Phase 2 (Warnings): ~45 minutes
- Testing: ~15 minutes
- **Total: ~1.5 hours**

---

## Notes

- Some unused variables in test files are intentionally there for future test expansion - these should be prefixed with `_` rather than removed
- The React hooks dependencies warnings in contexts require careful consideration - adding dependencies could cause infinite loops
- Migration scripts are one-time use, so the typing improvements are primarily for consistency

