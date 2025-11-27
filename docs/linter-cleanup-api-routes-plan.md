# Linter Cleanup Plan: API Routes Warnings

**Date:** 2025-11-27  
**Status:** In Progress  
**Target:** 114 warnings in `app/api/`  
**Type:** `@typescript-eslint/no-unused-vars`

## Overview

This plan addresses the 114 unused variable warnings in the `app/api/` directory. These are low-risk fixes that involve:
1. Removing unused imports
2. Prefixing intentionally unused parameters with `_`
3. Removing unused variable assignments

## Categorized Warnings

### Category 1: Unused Drizzle ORM Imports (Most Common)
These are imported from `drizzle-orm` but not used in the file.

**Common unused imports:**
- `like`, `or`, `and` (query operators)
- `desc`, `asc` (ordering)
- `sql` (raw SQL)

**Fix:** Remove unused imports from the import statement.

### Category 2: Unused `request` Parameter
API route handlers often have `request` parameter that isn't used.

**Example:**
```typescript
export async function GET(request: NextRequest, { params }) {
  // request is never used
}
```

**Fix:** Prefix with underscore: `_request: NextRequest`

### Category 3: Unused Assigned Variables
Variables that are assigned but never read.

**Examples:**
- `const result = await db.insert(...)` where result isn't used
- `const startDateStr = ...` computed but never used
- `const newInstance = ...` created but not returned

**Fix:** 
- Remove the variable if truly unused
- If side effect is needed, remove the assignment: `await db.insert(...)`
- Use `void` prefix if intentional: `void someAsyncCall()`

### Category 4: Unused Schema Imports
Importing schema tables that aren't used in queries.

**Fix:** Remove unused schema imports.

## Implementation Strategy

### Phase 1: Automated Analysis
Identify all files with warnings and categorize them.

### Phase 2: Batch Fixes by Pattern
Fix in batches to minimize risk:
1. First: Unused imports (safest)
2. Second: Unused `request` parameters
3. Third: Unused variables (review each carefully)

### Phase 3: Verification
- Run ESLint after each batch
- Run tests to ensure no regressions
- Verify build succeeds

## Files to Fix (by directory)

Based on the warning patterns, files are organized by API endpoint:

### High Priority (Multiple Warnings)
1. `app/api/cron/` - decay, cleanup routes
2. `app/api/bills/` - CRUD and matching
3. `app/api/budgets/` - analytics, export
4. `app/api/transactions/` - search, history
5. `app/api/categories/` - CRUD operations
6. `app/api/merchants/` - CRUD operations

### Medium Priority
7. `app/api/accounts/` 
8. `app/api/custom-fields/`
9. `app/api/goals/`
10. `app/api/debts/`
11. `app/api/reports/`

### Lower Priority (Single Warnings)
12. `app/api/auth/`
13. `app/api/user/`
14. `app/api/households/`
15. Other miscellaneous routes

## Step-by-Step Implementation

### Step 1: Fix Unused Imports
For each file, identify and remove unused imports from:
- `drizzle-orm` (like, or, and, desc, asc, sql)
- `@/lib/db/schema` (unused table imports)
- Other libraries

### Step 2: Fix Unused Request Parameters
For route handlers that don't use the `request` parameter:
```typescript
// Before
export async function GET(request: NextRequest, { params }) {

// After  
export async function GET(_request: NextRequest, { params }) {
```

### Step 3: Fix Unused Variables
Review each unused variable:
- If truly unused, remove it
- If used for side effects, remove the assignment
- If intentionally ignored, prefix with `_`

### Step 4: Run Verification
```bash
pnpm eslint app/api/ --format stylish
pnpm test
pnpm build
```

## Risk Assessment

**Risk Level:** Low

These fixes are purely cosmetic and don't change runtime behavior:
- Removing unused imports has zero runtime impact
- Prefixing parameters with `_` is a naming convention
- Removing unused assignments only removes dead code

## Success Criteria

- [ ] All 114 warnings in `app/api/` resolved
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No runtime errors introduced

## Notes

- Keep the structure of functions intact
- Don't refactor logic while fixing linting
- Document any unusual patterns found
- Use `// eslint-disable-next-line` only if truly necessary

## Progress Tracking

**Started:** 114 warnings  
**Current:** 45 warnings  
**Fixed:** 69 warnings (60% reduction)

### Changes Made

1. **ESLint Config Update**: Added rule to ignore underscore-prefixed variables
   - `varsIgnorePattern: "^_"` - allows `_variable` naming for intentionally unused vars
   - `argsIgnorePattern: "^_"` - allows `_request` for unused function parameters

2. **Files Fixed:**
   - app/api/cron/usage-decay/route.ts - Removed unused `UsageDecayConfig` import, unused `results` variables
   - app/api/bills/instances/route.ts - Removed unused `desc` import, commented out unused variables
   - app/api/bills/match/route.ts - Removed unused variables
   - app/api/bills/detect/route.ts - Removed unused imports
   - app/api/health/route.ts - Prefixed unused parameters with `_`
   - app/api/settings/notification-preferences/route.ts - Prefixed unused destructured vars
   - app/api/notifications/bill-reminders/route.ts - Prefixed unused parameters
   - app/api/households/[householdId]/*/route.ts - Various fixes
   - app/api/user/*/route.ts - Various fixes
   - app/api/admin/*/route.ts - Removed unused imports
   - app/api/budgets/*/route.ts - Removed unused imports and variables
   - app/api/debts/*/route.ts - Removed unused imports
   - app/api/merchants/route.ts - Removed unused variable assignments
   - app/api/tags/route.ts - Removed unused variable assignments
   - Many more files...

| Batch | Directory | Status |
|-------|-----------|--------|
| 1 | app/api/cron/ | ✅ Complete |
| 2 | app/api/bills/ | ✅ Mostly complete |
| 3 | app/api/budgets/ | ✅ Mostly complete |
| 4 | app/api/notifications/ | ✅ Complete |
| 5 | app/api/households/ | ✅ Mostly complete |
| 6 | app/api/user/ | ✅ Mostly complete |
| 7 | Remaining routes | ⏳ In progress |

