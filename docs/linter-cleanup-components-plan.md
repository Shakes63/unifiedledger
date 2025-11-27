# Linter Cleanup - Components Directory Plan

**Date:** 2025-11-27  
**Status:** In Progress (143 of 210 warnings fixed)  
**Remaining:** 67 warnings  
**Build:** Passing  
**Parent Plan:** `docs/linter-cleanup-phase1-continuation.md`

## Overview

This plan details the step-by-step approach to fix all 210 warnings in the `components/` directory. Warnings are organized by fix type for efficient batch processing.

## Warning Distribution by Category

| Category | Count | Fix Type |
|----------|-------|----------|
| Unused imports | ~45 | Remove from import statement |
| Unused destructured variables | ~35 | Prefix with `_` |
| Unused caught errors | ~40 | Prefix with `_` (e.g., `error` → `_error`) |
| Unused assigned variables | ~30 | Prefix with `_` or remove if dead code |
| Unused function parameters | ~20 | Prefix with `_` |
| react-hooks/exhaustive-deps | ~25 | Add missing dependencies or use `useCallback` |
| Unused eslint-disable directive | 1 | Remove the directive |
| react-hooks/incompatible-library | 1 | Add disable comment (known TanStack Virtual issue) |
| @next/next/no-img-element | 1 | Convert to Next.js Image or add disable comment |

---

## Task 1: Fix Unused Imports (~45 fixes)

Files with unused imports to remove:

### Batch 1.1: Settings Components (12 files)
| File | Unused Imports |
|------|----------------|
| settings/admin-users-tab.tsx | `CardDescription`, `CardHeader`, `CardTitle` |
| settings/advanced-tab.tsx | `Search` |
| settings/backup-settings-form.tsx | `Save` |
| settings/data-tab.tsx | `CheckCircle2`, `HardDrive` |
| settings/household-personal-tab.tsx | `Lock` |
| settings/household-tab.tsx | `Household` |
| settings/oauth-providers-section.tsx | `CheckCircle2` |
| settings/performance-monitor.tsx | `TrendingDown`, `TrendingUp`, `getAverageMetrics`, `exportMetricsAsJSON` |
| settings/permission-manager.tsx | `Shield` |
| settings/privacy-tab.tsx | `Shield` |

### Batch 1.2: Navigation & UI Components (6 files)
| File | Unused Imports |
|------|----------------|
| navigation/mobile-nav.tsx | `Bell` |
| navigation/sidebar.tsx | `Bell`, `Palette` |
| dashboard/collapsible-section.tsx | `ChevronUp` |
| ui/offline-banner.tsx | `CheckCircle2` |
| onboarding/steps/create-household-step.tsx | `CheckCircle2` |
| onboarding/onboarding-step.tsx | `cn` |

### Batch 1.3: Transaction Components (8 files)
| File | Unused Imports |
|------|----------------|
| transactions/advanced-search.tsx | `Select` |
| transactions/merchant-autocomplete.tsx | `Card` |
| transactions/saved-searches.tsx | `Dialog` |
| transactions/split-builder.tsx | `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` |
| transactions/transaction-form-mobile.tsx | `ChevronDown`, `ChevronUp` |
| transactions/transaction-form.tsx | `CustomFieldValue` |
| transactions/transaction-history.tsx | `Trash2` |
| transactions/transaction-templates-manager.tsx | `Input`, `Label`, `Plus`, `Account` |
| transactions/transaction-templates.tsx | `Card` |
| transactions/transfer-suggestions-modal.tsx | `MatchScore` |

### Batch 1.4: Other Components (12 files)
| File | Unused Imports |
|------|----------------|
| budget-summary/allocation-trends-chart.tsx | `Legend` |
| budgets/variable-bill-tracker.tsx | `Decimal` |
| calendar/calendar-header.tsx | `useState`, `isToday`, `isTomorrow`, `startOfMonth`, `endOfMonth` |
| calendar/calendar-week.tsx | `TransactionIndicators`, `TrendingUp`, `TrendingDown` |
| csv-import/csv-import-modal.tsx | `parseCSVFile` |
| dashboard/bills-widget.tsx | `toast` |
| dashboard/debt-free-countdown.tsx | `Flame`, `Zap` |
| dashboard/recent-transactions.tsx | `Badge` |
| dashboard/savings-goals-widget.tsx | `toast` |
| debts/payment-comparison-pie-charts.tsx | `Legend` |
| debts/payment-streak-widget.tsx | `PartyPopper`, `Target` |
| debts/principal-interest-chart.tsx | `PartyPopper` |
| debts/total-debt-chart.tsx | `format` |
| rules/rule-builder.tsx | `ChevronDown` |
| rules/rules-manager.tsx | `Receipt` |
| transfers/transfer-list.tsx | `useEffect`, `DialogDescription` |

---

## Task 2: Fix Unused Caught Errors (~40 fixes)

Prefix error variables with underscore: `error` → `_error`

### Batch 2.1: Settings Components (24 fixes)
| File | Line | Change |
|------|------|--------|
| settings/admin-tab.tsx | 191 | `error` → `_error` |
| settings/advanced-tab.tsx | 57, 129 | `error` → `_error` (2 places) |
| settings/cache-settings.tsx | 53, 69 | `err` → `_err` (2 places) |
| settings/data-tab.tsx | 73, 111, 143, 171 | `error` → `_error` (4 places) |
| settings/household-members-tab.tsx | 115, 149, 174, 204, 237, 263, 284 | `error` → `_error` (7 places) |
| settings/household-tab.tsx | 115, 160, 191, 225, 261, 294, 339, 370, 394, 426 | `error` → `_error` (10 places) |
| settings/privacy-tab.tsx | 95, 119, 139, 154, 175, 205, 244 | `error` → `_error` (7 places) |

### Batch 2.2: Other Components (16 fixes)
| File | Line | Change |
|------|------|--------|
| auth/user-menu.tsx | 71 | `error` → `_error` |
| budgets/variable-bill-tracker.tsx | 122 | `e` → `_e` |
| dashboard/compact-stats-bar.tsx | 100, 127, 152 | `err` → `_err` (3 places) |
| debts/debt-payoff-tracker.tsx | 116 | `error` → `_error` |
| goals/goal-tracker.tsx | 111 | `error` → `_error` |
| transactions/advanced-search.tsx | 221, 253 | `e` → `_e`, `error` → `_error` (2 places) |

---

## Task 3: Fix Unused Destructured Variables (~35 fixes)

Prefix with underscore for array destructuring: `[variable, setVariable]` → `[_variable, setVariable]`

### Batch 3.1: Transaction Components (12 fixes)
| File | Line | Variable | Change |
|------|------|----------|--------|
| transactions/account-selector.tsx | 36 | `loading` | `_loading` |
| transactions/budget-warning.tsx | 34 | `loading` | `_loading` |
| transactions/category-selector.tsx | 53 | `loading` | `_loading` |
| transactions/merchant-autocomplete.tsx | 40 | `loading` | `_loading` |
| transactions/merchant-selector.tsx | 36 | `loading` | `_loading` |
| transactions/transaction-form.tsx | 109 | `customFieldsLoading` | `_customFieldsLoading` |
| transactions/transaction-form.tsx | 111 | `accountsLoading` | `_accountsLoading` |
| transactions/transaction-form-mobile.tsx | 34 | `isFormCollapsed`, `setIsFormCollapsed` | `_isFormCollapsed`, `_setIsFormCollapsed` |
| transactions/transaction-templates-manager.tsx | 56-57 | `showNewForm`, `setShowNewForm`, `newTemplate`, `setNewTemplate` | Prefix all with `_` |
| transfers/transfer-form.tsx | 61 | `selectedFromAccountId`, `setSelectedFromAccountId` | Prefix with `_` |

### Batch 3.2: Dashboard & Other Components (10 fixes)
| File | Line | Variable | Change |
|------|------|----------|--------|
| budgets/budget-export-modal.tsx | 31 | `selectedHouseholdId` | `_selectedHouseholdId` |
| csv-import/csv-import-modal.tsx | 49 | `fileContent` | `_fileContent` |
| csv-import/csv-import-modal.tsx | 67 | `importId` | `_importId` |
| custom-fields/custom-field-manager.tsx | 56 | `editingId` | `_editingId` |
| offline/sync-status.tsx | 25 | `syncResult` | `_syncResult` |
| settings/profile-tab.tsx | 45 | `resendingEmailChange` | `_resendingEmailChange` |
| settings/two-factor-section.tsx | 55 | `verifyDialogOpen` | `_verifyDialogOpen` |
| ui/offline-banner.tsx | 42 | `dismissTime` | `_dismissTime` |
| dashboard/recent-transactions.tsx | 145 | `newTransaction` | `_newTransaction` |
| onboarding/steps/create-transaction-step.tsx | 26-27 | `setIsSubmitting`, `accounts` | Prefix with `_` |

---

## Task 4: Fix Unused Assigned Variables (~30 fixes)

Prefix variable assignments with underscore or remove dead code.

### Batch 4.1: Dashboard & Settings (12 fixes)
| File | Line | Variable | Fix |
|------|------|----------|-----|
| budget-summary/monthly-surplus-card.tsx | 33 | `isOnTrack` | `_isOnTrack` |
| budgets/variable-bill-card.tsx | 152, 160 | `percentChange`, `consecutiveUnder` | Prefix with `_` |
| calendar/calendar-header.tsx | 33, 35 | `tomorrow`, `handleQuickDate` | Remove (dead code) |
| dashboard/bills-widget.tsx | 125 | `paidCount` | `_paidCount` |
| dashboard/recent-transactions.tsx | 248 | `getTypeColor` | Remove (dead code) |
| debts/credit-utilization-badge.tsx | 35 | `level` | `_level` |
| debts/payoff-timeline.tsx | 24 | `maxMonths` | `_maxMonths` |
| debts/total-cost-pie-chart.tsx | 27 | `name` | `_name` |
| settings/admin-users-tab.tsx | 336 | `RoleIcon` | Remove (dead code) |
| settings/backup-settings-form.tsx | 94, 145 | `updatedSettings`, `data` | Prefix with `_` |
| settings/household-tab.tsx | 61 | `setSelectedHouseholdId` | `_setSelectedHouseholdId` |
| settings/profile-tab.tsx | 89 | `handleResendEmailChange` | Remove (dead code) |

### Batch 4.2: Transaction & Other Components (8 fixes)
| File | Line | Variable | Fix |
|------|------|----------|-----|
| transactions/budget-warning.tsx | 90, 108 | `isOverBudget`, `progressColor` | Prefix with `_` |
| transactions/convert-to-transfer-modal.tsx | 194-196 | `sourceAccount`, `targetAccount`, `selectedMatch` | Prefix with `_` |
| transactions/transaction-details.tsx | 193 | `isExpense` | `_isExpense` |
| transfers/transfer-form.tsx | 82-83 | `toAccountId`, `amount` | Prefix with `_` |
| offline/sync-status.tsx | 73 | `handleAutoSync` | Remove (dead code) |
| settings/permission-manager.tsx | 210 | `resetToDefaults` | Remove (dead code) |
| debts/debt-reduction-summary.tsx | 38 | `getProgressGradient` | Remove (dead code) |

---

## Task 5: Fix Unused Function Parameters (~20 fixes)

Prefix unused parameters with underscore.

| File | Line | Parameter | Change |
|------|------|-----------|--------|
| bills/annual-planning-grid.tsx | 38, 98 | `monthNames`, `index` | `_monthNames`, `_index` |
| calendar/calendar-week.tsx | 42 | `onDayClick` | `_onDayClick` |
| charts/pie-chart.tsx | 44 | `nameKey` | `_nameKey` |
| debts/amortization-table.tsx | 44 | `index` | `_index` |
| debts/individual-debts-chart.tsx | 204 | `index` | `_index` |
| debts/payment-history-list.tsx | 160 | `index` | `_index` |
| debts/payoff-timeline.tsx | 69 | `index` | `_index` |
| debts/debt-payoff-tracker.tsx | 59 | `payments` | `_payments` |
| experimental/feature-gate.tsx | 43 | `featureId` | `_featureId` |
| navigation/dashboard-layout.tsx | 38 | `showTopNav` | `_showTopNav` |
| onboarding/onboarding-step.tsx | 27 | `stepNumber` | `_stepNumber` |
| rules/rule-builder.tsx | 81 | `level` | `_level` |
| settings/oauth-providers-section.tsx | 189 | `providerId` | `_providerId` |

---

## Task 6: Fix react-hooks/exhaustive-deps (~25 fixes)

Add missing dependencies to useEffect/useMemo dependency arrays.

### Pattern A: Add function as dependency (use useCallback)
For functions defined inside component that are called in useEffect.

### Pattern B: Add the missing dependency directly
When the dependency is stable (won't cause infinite re-renders).

| File | Line | Missing Dependency | Fix Strategy |
|------|------|-------------------|--------------|
| budgets/apply-surplus-modal.tsx | 72 | `fetchSuggestion` | Wrap in `useCallback` |
| budgets/budget-manager-modal.tsx | 53 | `fetchCategories` | Wrap in `useCallback` |
| calendar/calendar-week.tsx | 75 | `days` | Add to deps array |
| dashboard/budget-summary-widget.tsx | 36 | `fetchBudgetSummary` | Wrap in `useCallback` |
| dashboard/budget-surplus-card.tsx | 53 | `fetchBudgetSummary` | Wrap in `useCallback` |
| dashboard/debt-countdown-card.tsx | 26 | `fetchCountdownData` | Wrap in `useCallback` |
| dashboard/debt-free-countdown.tsx | 42 | `fetchCountdownData` | Wrap in `useCallback` |
| dashboard/enhanced-bills-widget.tsx | 41, 53 | `fetchBills` | Wrap in `useCallback` |
| dashboard/recent-transactions.tsx | 123 | `fetchWithHousehold` | Add to deps (stable) |
| dashboard/spending-summary.tsx | 45 | `fetchSummary` | Wrap in `useCallback` |
| debts/payoff-timeline.tsx | 48 | `strategy` | Add to deps array |
| debts/what-if-calculator.tsx | 48 | `calculateScenarios` | Wrap in `useCallback` |
| household/activity-feed.tsx | 79 | `loadActivities` | Wrap in `useCallback` |
| settings/advanced-tab.tsx | 46 | `fetchDatabaseStats` | Wrap in `useCallback` |
| settings/backup-history.tsx | 41 | `fetchBackups` | Wrap in `useCallback` |
| settings/backup-settings-form.tsx | 50 | `fetchSettings` | Wrap in `useCallback` |
| settings/household-members-tab.tsx | 83 | `fetchHouseholdDetails` | Wrap in `useCallback` |
| settings/household-personal-tab.tsx | 67 | `fetchPreferences` | Wrap in `useCallback` |
| settings/household-tab.tsx | 101 | `fetchHouseholdDetails` | Wrap in `useCallback` |
| settings/permission-manager.tsx | 155 | `fetchPermissions` | Wrap in `useCallback` |
| transactions/account-selector.tsx | 65 | `fetchWithHousehold` | Add to deps (stable) |
| transactions/category-selector.tsx | 129 | `fetchWithHousehold` | Add to deps (stable) |
| transactions/convert-to-transfer-modal.tsx | 86 | `fetchWithHousehold`, `selectedHouseholdId` | Add to deps |
| transactions/merchant-selector.tsx | 64 | `fetchWithHousehold` | Add to deps (stable) |
| transactions/recent-transactions.tsx | 57 | `fetchWithHousehold` | Add to deps (stable) |
| transactions/transaction-form.tsx | 245, 281 | `fetchWithHousehold` | Add to deps (stable) |
| transactions/transaction-history.tsx | 45 | `fetchHistory` | Wrap in `useCallback` |
| transactions/transaction-templates-manager.tsx | 68 | `fetchTemplates` | Wrap in `useCallback` |

---

## Task 7: Miscellaneous Fixes (3 fixes)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| budget-summary/allocation-trends-chart.tsx | 137 | Unused eslint-disable directive | Remove directive |
| debts/amortization-table.tsx | 26 | react-hooks/incompatible-library | Add `// eslint-disable-next-line react-hooks/incompatible-library` |
| ui/avatar-upload.tsx | 145 | @next/next/no-img-element | Convert to `<Image>` or add disable comment if preview image |
| navigation/dashboard-layout.tsx | 14 | Unused `sidebarOpen` | Prefix with `_sidebarOpen` |

---

## Implementation Order

### Phase A: Quick Wins (Batches 1-3) - COMPLETE
1. [x] **Batch 1.1-1.4:** Remove unused imports (45 files) - DONE
2. [x] **Batch 2.1-2.2:** Fix unused caught errors (40 fixes) - DONE
3. [x] **Batch 3.1-3.2:** Fix unused destructured variables (35 fixes) - DONE

### Phase B: Variable Fixes (Batch 4-5) - MOSTLY COMPLETE
4. [x] **Batch 4.1-4.2:** Fix unused assigned variables (30 fixes) - DONE
5. [x] **Batch 5:** Fix unused function parameters (15 of 20 fixes) - MOSTLY DONE
   - Remaining: ~5 index parameters in map callbacks

### Phase C: Hook Dependencies (Batch 6) - PENDING
6. [ ] **Batch 6:** Fix react-hooks/exhaustive-deps (~20 remaining)
   - Wrap fetch functions in `useCallback`
   - Add stable dependencies to arrays

### Phase D: Final Cleanup (Batch 7) - PENDING
7. [ ] **Batch 7:** Miscellaneous fixes (3 fixes)
   - Remove unused eslint-disable directive
   - Add disable comment for TanStack Virtual incompatibility
   - Convert img to Next.js Image or add disable comment

---

## Verification Steps

After each batch:
1. Run `pnpm eslint components/[target-dir]/ --format stylish`
2. Run `pnpm build` (ensure no type errors)
3. Spot check in browser (ensure no runtime errors)

After all batches:
1. Run `pnpm eslint components/ --format stylish` - Target: 0 warnings
2. Run `pnpm build` - Target: Success
3. Run `pnpm test` - Target: All pass

---

## Risk Assessment

**Risk Level:** Low

All fixes are:
- Removing dead code (unused imports/variables)
- Renaming conventions (underscore prefix)
- Adding dependencies to hook arrays (no logic changes)

**Medium Risk Items:**
- `react-hooks/exhaustive-deps` fixes - need to verify no infinite loops
- Converting dead code removals - verify truly dead before removing

---

## Success Criteria

- [x] Reduce warnings from 210 to under 100 (achieved: 68 remaining)
- [ ] Fix remaining `react-hooks/exhaustive-deps` warnings
- [ ] 0 warnings in `components/` directory
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No runtime errors in browser

## Progress Summary (2025-11-27)

| Category | Original | Fixed | Remaining |
|----------|----------|-------|-----------|
| Unused imports | ~45 | 45 | 0 |
| Unused caught errors | ~40 | 40 | 0 |
| Unused destructured variables | ~35 | 35 | 0 |
| Unused assigned variables | ~30 | 30 | 0 |
| Unused function parameters | ~20 | 17 | ~3 |
| react-hooks/exhaustive-deps | ~25 | 0 | ~20 |
| Miscellaneous | ~3 | 0 | 3 |
| **Total** | **210** | **143** | **67** |

## Session Notes

- Fixed 143 warnings in a single session
- All changes verified with `pnpm build` - passes
- Remaining warnings are mostly `react-hooks/exhaustive-deps` which require careful analysis
- No runtime behavior changes - all fixes are dead code removal or naming conventions

---

## Notes

- Keep changes minimal - only fix the warning, don't refactor
- For `react-hooks/exhaustive-deps`, prefer `useCallback` pattern to avoid infinite loops
- Use `// eslint-disable-next-line` sparingly and only for known false positives
- Commit after each major batch for easy rollback

