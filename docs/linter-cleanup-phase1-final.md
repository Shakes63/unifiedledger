# Linter Cleanup Phase 1 Final - Implementation Plan

**Date:** 2025-11-27  
**Status:** ✅ COMPLETE  
**Final Issues:** 196 problems (196 errors, 0 warnings)  
**This Phase Target:** Fix remaining 67 warnings to complete Phase 1 - **DONE!**  
**Build:** Passing  
**Parent Plan:** `docs/linter-cleanup-phase1-continuation.md`

---

## Overview

This plan details the final steps to complete Phase 1 of the linter cleanup. After this, the `components/` directory will have 0 warnings, leaving only errors for Phase 2.

## Warning Summary (67 total)

| Category | Count | Fix Type |
|----------|-------|----------|
| `react-hooks/exhaustive-deps` | 22 | Add missing dependencies with useCallback |
| `@typescript-eslint/no-unused-vars` | 42 | Prefix with `_` or remove |
| `@next/next/no-img-element` | 1 | Add eslint-disable comment (preview image) |
| `react-hooks/incompatible-library` | 1 | Add eslint-disable comment (TanStack Virtual) |
| Unused eslint-disable directive | 1 | Remove directive |

---

## Task 1: Fix react-hooks/exhaustive-deps Warnings (22 fixes)

### Strategy
The `react-hooks/exhaustive-deps` warnings occur when a function used inside `useEffect` is defined outside the dependency array. The fix is to:

1. **For fetch functions defined in component:** Wrap in `useCallback` with proper dependencies
2. **For stable hooks (like `fetchWithHousehold`):** Add to dependency array (won't cause re-renders)
3. **For primitive values (like `strategy`):** Add directly to dependency array

### 1.1: Fetch Functions - Wrap in useCallback (14 files)

These functions need to be wrapped in `useCallback` to be safely added to dependency arrays:

| File | Function | Dependencies |
|------|----------|--------------|
| `budgets/apply-surplus-modal.tsx:72` | `fetchSuggestion` | Modal open state, amount |
| `budgets/budget-manager-modal.tsx:53` | `fetchCategories` | Modal open state |
| `dashboard/budget-summary-widget.tsx:36` | `fetchBudgetSummary` | `fetchWithHousehold`, `selectedHouseholdId` |
| `dashboard/budget-surplus-card.tsx:53` | `fetchBudgetSummary` | `fetchWithHousehold`, `selectedHouseholdId` |
| `dashboard/debt-countdown-card.tsx:26` | `fetchCountdownData` | None (stable) |
| `dashboard/debt-free-countdown.tsx:42` | `fetchCountdownData` | None (stable) |
| `dashboard/enhanced-bills-widget.tsx:41,53` | `fetchBills` | `fetchWithHousehold`, `selectedHouseholdId` |
| `dashboard/spending-summary.tsx:45` | `fetchSummary` | `fetchWithHousehold`, `selectedHouseholdId` |
| `debts/what-if-calculator.tsx:48` | `calculateScenarios` | Input values |
| `household/activity-feed.tsx:79` | `loadActivities` | `householdId` |
| `settings/advanced-tab.tsx:46` | `fetchDatabaseStats` | None (stable) |
| `settings/backup-history.tsx:41` | `fetchBackups` | None (stable) |
| `settings/backup-settings-form.tsx:50` | `fetchSettings` | None (stable) |
| `settings/household-members-tab.tsx:83` | `fetchHouseholdDetails` | `viewingHouseholdId` |
| `settings/household-personal-tab.tsx:67` | `fetchPreferences` | `viewingHouseholdId` |
| `settings/household-tab.tsx:101` | `fetchHouseholdDetails` | `viewingHouseholdId` |
| `settings/permission-manager.tsx:155` | `fetchPermissions` | None (stable) |
| `transactions/transaction-history.tsx:45` | `fetchHistory` | `transactionId` |
| `transactions/transaction-templates-manager.tsx:66` | `fetchTemplates` | `fetchWithHousehold`, `selectedHouseholdId` |

### 1.2: Add Stable Dependencies Directly (8 files)

For hooks that are memoized and stable (like `fetchWithHousehold`), add them directly:

| File | Line | Add to deps |
|------|------|-------------|
| `dashboard/recent-transactions.tsx` | 122 | `fetchWithHousehold` |
| `transactions/account-selector.tsx` | 65 | `fetchWithHousehold` |
| `transactions/category-selector.tsx` | 129 | `fetchWithHousehold` |
| `transactions/convert-to-transfer-modal.tsx` | 86 | `fetchWithHousehold`, `selectedHouseholdId` |
| `transactions/merchant-selector.tsx` | 64 | `fetchWithHousehold` |
| `transactions/recent-transactions.tsx` | 57 | `fetchWithHousehold` |
| `transactions/transaction-form.tsx` | 245, 281 | `fetchWithHousehold` |

### 1.3: Add Primitive Dependencies (2 files)

| File | Line | Add to deps |
|------|------|-------------|
| `calendar/calendar-week.tsx` | 74 | `days` (array) |
| `debts/payoff-timeline.tsx` | 48 | `strategy` (string) |

---

## Task 2: Fix Unused Variables Warnings (42 fixes)

### 2.1: Unused Imports (6 files)

Remove these unused imports:

| File | Unused Import |
|------|---------------|
| `calendar/calendar-header.tsx:3` | `useState` |
| `transactions/transaction-form.tsx:73` | `CustomFieldValue` |
| `transactions/transaction-templates-manager.tsx:32` | `Account` |
| `transactions/transfer-suggestions-modal.tsx:10` | `MatchScore` |

### 2.2: Unused Destructured Variables (26 fixes)

Prefix with underscore in array/object destructuring:

| File | Line | Variable | Change |
|------|------|----------|--------|
| `transactions/account-selector.tsx` | 36 | `loading` | `_loading` |
| `transactions/budget-warning.tsx` | 34 | `loading` | `_loading` |
| `transactions/budget-warning.tsx` | 90 | `isOverBudget` | `_isOverBudget` |
| `transactions/budget-warning.tsx` | 108 | `progressColor` | `_progressColor` |
| `transactions/category-selector.tsx` | 53 | `loading` | `_loading` |
| `transactions/merchant-autocomplete.tsx` | 39 | `loading` | `_loading` |
| `transactions/merchant-selector.tsx` | 36 | `loading` | `_loading` |
| `transactions/transaction-form-mobile.tsx` | 34 | `isFormCollapsed, setIsFormCollapsed` | `_isFormCollapsed, _setIsFormCollapsed` |
| `transactions/transaction-form.tsx` | 109 | `customFieldsLoading` | `_customFieldsLoading` |
| `transactions/transaction-form.tsx` | 111 | `accountsLoading` | `_accountsLoading` |
| `transactions/convert-to-transfer-modal.tsx` | 194 | `sourceAccount` | `_sourceAccount` |
| `transactions/convert-to-transfer-modal.tsx` | 195 | `targetAccount` | `_targetAccount` |
| `transactions/convert-to-transfer-modal.tsx` | 196 | `selectedMatch` | `_selectedMatch` |
| `transactions/transaction-details.tsx` | 193 | `isExpense` | `_isExpense` |
| `transactions/transaction-templates-manager.tsx` | 54 | `showNewForm, setShowNewForm` | `_showNewForm, _setShowNewForm` |
| `transactions/transaction-templates-manager.tsx` | 55 | `newTemplate, setNewTemplate` | `_newTemplate, _setNewTemplate` |
| `transfers/transfer-form.tsx` | 61 | `selectedFromAccountId, setSelectedFromAccountId` | `_selectedFromAccountId, _setSelectedFromAccountId` |
| `transfers/transfer-form.tsx` | 82 | `toAccountId` | `_toAccountId` |
| `transfers/transfer-form.tsx` | 83 | `amount` | `_amount` |

### 2.3: Unused Function Parameters (6 fixes)

Prefix unused callback parameters with underscore:

| File | Line | Parameter | Change |
|------|------|-----------|--------|
| `debts/amortization-table.tsx` | 44 | `index` | `_index` |
| `debts/individual-debts-chart.tsx` | 204 | `index` | `_index` |
| `debts/payment-history-list.tsx` | 160 | `index` | `_index` |
| `debts/payoff-timeline.tsx` | 69 | `index` | `_index` |
| `settings/oauth-providers-section.tsx` | 188 | `providerId` | `_providerId` |
| `settings/permission-manager.tsx` | 210 | `resetToDefaults` | `_resetToDefaults` or remove |

---

## Task 3: Fix Miscellaneous Warnings (3 fixes)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `budget-summary/allocation-trends-chart.tsx` | 136 | Unused eslint-disable directive | Remove the `// eslint-disable-next-line` comment |
| `debts/amortization-table.tsx` | 26 | `react-hooks/incompatible-library` | Add `// eslint-disable-next-line react-hooks/incompatible-library` |
| `ui/avatar-upload.tsx` | 145 | `@next/next/no-img-element` | Add `// eslint-disable-next-line @next/next/no-img-element` (preview image for upload) |

---

## Implementation Order

### Phase A: Quick Wins (15-20 minutes)
1. **Task 2.1:** Remove unused imports (4 files)
2. **Task 2.2:** Fix unused destructured variables (26 fixes across ~12 files)
3. **Task 2.3:** Fix unused parameters (6 fixes)
4. **Task 3:** Miscellaneous fixes (3 fixes)

### Phase B: Hook Dependencies (30-40 minutes)
5. **Task 1.2:** Add stable dependencies directly (8 files)
6. **Task 1.3:** Add primitive dependencies (2 files)
7. **Task 1.1:** Wrap fetch functions in useCallback (14 files)

---

## Verification Steps

After each batch:
1. Run `pnpm eslint components/[target-dir]/ --format stylish`
2. Run `pnpm build` to ensure no type errors
3. Spot check in browser for runtime errors

After all tasks complete:
1. Run `pnpm eslint components/ --format stylish` - **Target: 196 errors, 0 warnings**
2. Run `pnpm build` - **Target: Success**
3. Run `pnpm test` - **Target: All pass**

---

## Implementation Patterns

### Pattern A: useCallback for Fetch Functions

**Before:**
```typescript
const fetchData = async () => {
  const response = await fetchWithHousehold('/api/data');
  setData(response);
};

useEffect(() => {
  fetchData();
}, []); // Warning: missing dependency 'fetchData'
```

**After:**
```typescript
const fetchData = useCallback(async () => {
  const response = await fetchWithHousehold('/api/data');
  setData(response);
}, [fetchWithHousehold]);

useEffect(() => {
  fetchData();
}, [fetchData]); // No warning
```

### Pattern B: Add Stable Hook to Dependencies

**Before:**
```typescript
const { fetchWithHousehold } = useHouseholdFetch();

useEffect(() => {
  fetchWithHousehold('/api/data').then(setData);
}, []); // Warning: missing dependency
```

**After:**
```typescript
const { fetchWithHousehold } = useHouseholdFetch();

useEffect(() => {
  fetchWithHousehold('/api/data').then(setData);
}, [fetchWithHousehold]); // No warning - fetchWithHousehold is stable
```

### Pattern C: Prefix Unused Variables

**Before:**
```typescript
const [loading, setLoading] = useState(false);
// 'loading' is never used
```

**After:**
```typescript
const [_loading, setLoading] = useState(false);
// No warning
```

---

## Risk Assessment

**Risk Level:** Low

All fixes are:
- **Naming conventions** (underscore prefix) - No runtime impact
- **Import removals** - Dead code removal
- **Dependency array updates** - Follows React best practices
- **useCallback wrapping** - Standard React optimization pattern

**Medium Risk Items:**
- `useCallback` wrapping needs verification that no infinite loops occur
- Ensure wrapped functions have correct dependencies

---

## Success Criteria

- [x] Plan document created
- [x] Task 2.1: Unused imports removed (4 files)
- [x] Task 2.2: Unused destructured variables fixed (26 fixes)
- [x] Task 2.3: Unused parameters fixed (6 fixes)
- [x] Task 3: Miscellaneous fixes applied (3 fixes)
- [x] Task 1.2: Stable dependencies added (8 files)
- [x] Task 1.3: Primitive dependencies added (2 files)
- [x] Task 1.1: Fetch functions wrapped in useCallback (19 files)
- [x] Final verification: 0 warnings in components/
- [x] Build succeeds

---

## Notes

- Keep changes minimal - only fix the warning, don't refactor
- For `react-hooks/exhaustive-deps`, prefer `useCallback` pattern
- Use `// eslint-disable-next-line` sparingly and only for known false positives
- Commit after completing each task for easy rollback

