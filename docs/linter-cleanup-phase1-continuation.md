# Linter Cleanup Phase 1 Continuation Plan

**Date:** 2025-11-27  
**Status:** In Progress  
**Current Issues:** 775 (419 errors, 356 warnings)  
**This Phase Target:** Fix remaining 356 warnings

## Overview

This plan continues Phase 1 of the linter cleanup, focusing on `@typescript-eslint/no-unused-vars` warnings. The goal is to eliminate all warnings before moving to Phase 2 (fixing `@typescript-eslint/no-explicit-any` errors).

## Current Distribution

| Directory | Errors | Warnings | Total |
|-----------|--------|----------|-------|
| app/api/ | 83 | 45 | 128 |
| components/ | 196 | 210 | 406 |
| Other (lib, tests, etc.) | 140 | 101 | 241 |
| **Total** | **419** | **356** | **775** |

## Implementation Strategy

### Priority Order
1. **Finish app/api/** - Complete remaining 45 warnings
2. **components/** - 210 warnings
3. **Remaining directories** - 101 warnings

### Fix Types
1. **Remove unused imports** - Safest, no runtime impact
2. **Prefix unused parameters with `_`** - Naming convention
3. **Prefix unused caught errors with `_`** - Naming convention
4. **Remove unused variable assignments** - Dead code removal

---

## Task 1: Complete app/api/ Warnings (45 remaining)

### Batch 1.1: Unused Imports (17 fixes)
| File | Line | Variable | Fix |
|------|------|----------|-----|
| auth/verify-email-change/route.ts | 4 | `and` | Remove from import |
| calendar/month/route.ts | 5 | `parse` | Remove from import |
| debts/adherence/route.ts | 5 | `sql` | Remove from import |
| debts/countdown/route.ts | 5 | `sql` | Remove from import |
| debts/reduction-chart/route.ts | 6 | `addMonths` | Remove from import |
| households/[householdId]/members/[memberId]/route.ts | 6 | `HouseholdRole` | Remove from import |
| onboarding/generate-demo-data/route.ts | 2 | `getHouseholdIdFromRequest` | Remove from import |
| reports/budget-vs-actual/route.ts | 11 | `calculateDateRange` | Remove from import |
| reports/category-breakdown/route.ts | 11 | `calculateDateRange` | Remove from import |
| reports/net-worth/route.ts | 13 | `Decimal` | Remove from import |
| spending-summary/route.ts | 4 | `sum`, `sql` | Remove from import |
| transactions/history/route.ts | 4 | `budgetCategories` | Remove from import |
| transactions/route.ts | 4 | `debtPayoffMilestones` | Remove from import |
| transactions/route.ts | 14 | `findMatchingBills` | Remove from import |
| transactions/search/route.ts | 4 | `customFieldValues` | Remove from import |
| user/resend-verification/route.ts | 18 | `and`, `gte` | Remove from import |
| user/two-factor/verify-login/route.ts | 2 | `auth` | Remove from import |

### Batch 1.2: Unused Request Parameters (9 fixes)
Prefix `request` with underscore: `_request`

| File | Line | Change |
|------|------|--------|
| auth/init/route.ts | 56 | `request` → `_request` |
| cron/backups/route.ts | 75 | `request` → `_request` |
| households/route.ts | 9 | `request` → `_request` |
| notification-preferences/route.ts | 7 | `request` → `_request` |
| notifications/debt-milestones/route.ts | 67 | `request` → `_request` |
| notifications/savings-milestones/route.ts | 67 | `request` → `_request` |
| sales-tax/categories/route.ts | 13 | `request` → `_request` |
| session/ping/route.ts | 16 | `request` → `_request` |

### Batch 1.3: Unused Caught Errors (6 fixes)
Prefix error variables with underscore: `_error`

| File | Line | Change |
|------|------|--------|
| rules/route.ts | 300 | `err` → `_err` |
| rules/route.ts | 499 | `err` → `_err` |
| telemetry/vitals/route.ts | 47 | `error` → `_error` |
| user/backups/[id]/download/route.ts | 40 | `error` → `_error` |
| user/backups/[id]/route.ts | 40 | `error` → `_error` |
| user/delete-account/route.ts | 81 | `verifyError` → `_verifyError` |
| user/two-factor/disable/route.ts | 71 | `error` → `_error` |
| user/two-factor/verify-login/route.ts | 75 | `error` → `_error` |

### Batch 1.4: Unused Variable Assignments (13 fixes)
Remove assignments or prefix with underscore

| File | Line | Variable | Fix |
|------|------|----------|-----|
| csv-import/route.ts | 133 | `idx` | Prefix with `_idx` |
| households/backfill-names/route.ts | 17 | `userId` | Prefix with `_userId` or remove |
| invitations/accept/route.ts | 12 | `email` | Prefix with `_email` |
| invitations/decline/route.ts | 10 | `userId` | Prefix with `_userId` |
| notifications/bill-reminders/route.ts | 43 | `userId` | Prefix with `_userId` |
| profile/avatar/upload/route.ts | 17 | `MAX_FILE_SIZE` | Prefix with `_MAX_FILE_SIZE` |
| reports/merchant-analysis/route.ts | 122 | `merchantIdsFromData` | Prefix with `_merchantIdsFromData` |
| rules/test/route.ts | 14 | `householdId` | Prefix with `_householdId` |
| suggestions/route.ts | 65 | `usageData` | Prefix with `_usageData` |
| transfers/route.ts | 263 | `transferPairKey` | Prefix with `_transferPairKey` |

---

## Task 2: Fix components/ Warnings (210 total)

### Top Priority Files (Most Warnings)
Based on ESLint output, these files have the most warnings:

1. **settings/tabs/*** - Multiple tabs with unused imports
2. **transactions/*** - Form components with unused state
3. **transfers/*** - Transfer components with unused variables
4. **charts/*** - Chart components with unused imports
5. **ui/*** - UI components with unused imports

### Common Patterns to Fix

1. **Unused UI imports** (Card, Dialog components)
2. **Unused React hooks** (useState, useEffect)
3. **Unused state variables from destructuring**
4. **Unused function parameters**
5. **react-hooks/exhaustive-deps** warnings (add missing deps or disable)

### Detailed File List (from ESLint output)

Will be populated during implementation phase.

---

## Verification Steps

After each batch:
1. Run `pnpm eslint app/api/ --format stylish` (for API routes)
2. Run `pnpm eslint components/ --format stylish` (for components)
3. Run `pnpm build` (ensure no build errors)
4. Run `pnpm test` (ensure no test regressions)

---

## Implementation Order

### Day 1: Complete app/api/ Warnings - DONE
- [x] Batch 1.1: Unused imports (17 files) - ~30 min
- [x] Batch 1.2: Unused request parameters (8 files) - ~15 min
- [x] Batch 1.3: Unused caught errors (8 files) - ~15 min
- [x] Batch 1.4: Unused variable assignments (10 files) - ~20 min
- [x] Verify: Run ESLint on app/api/ - 0 warnings confirmed

### Day 2-3: Fix components/ Warnings
- [ ] Settings tabs (estimated 40+ warnings)
- [ ] Transaction components (estimated 30+ warnings)
- [ ] Transfer components (estimated 20+ warnings)
- [ ] Chart components (estimated 20+ warnings)
- [ ] UI components (estimated 20+ warnings)
- [ ] Remaining components (estimated 80+ warnings)

### Day 4: Fix Remaining Directories
- [ ] lib/ (if any remaining)
- [ ] __tests__/
- [ ] scripts/
- [ ] contexts/
- [ ] hooks/

---

## Risk Assessment

**Risk Level:** Low

All Phase 1 fixes are:
- Removing dead code (unused imports/variables)
- Renaming conventions (underscore prefix)
- No logic changes
- No runtime behavior changes

---

## Success Criteria

- [ ] 0 warnings in app/api/
- [ ] 0 warnings in components/
- [ ] 0 warnings in entire codebase
- [ ] All tests pass
- [ ] Build succeeds

---

## Notes

- Keep changes minimal - only fix the warning, don't refactor
- Document any unusual patterns found
- Use `// eslint-disable-next-line` only if absolutely necessary
- Commit after each batch for easy rollback

