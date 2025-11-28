# Linter Phase 2 Completion Plan: Fix Remaining 67 `no-explicit-any` Errors

**Created:** 2025-11-28
**Status:** Ready to Implement
**Remaining Errors:** 67 `@typescript-eslint/no-explicit-any` errors in components/

---

## Overview

This plan completes the Linter Cleanup Phase 2 by fixing the remaining 67 `any` type errors across 21 files. The types infrastructure is already in place (`lib/types/index.ts`), so most fixes involve importing existing types or defining component-specific interfaces.

---

## Implementation Strategy

### Approach
1. **Leverage Existing Types:** Import from `lib/types/index.ts` wherever possible
2. **Add Missing Types:** Extend `lib/types/index.ts` with any new interfaces needed
3. **Use Specific Types:** Replace generic `Record<string, any>` with specific interfaces
4. **Fix by Category:** Group similar patterns together for efficiency

### Theme Integration
All components already use semantic CSS variables. No styling changes needed.

---

## Files to Fix (Grouped by Pattern)

### Group 1: Select/Input Event Handlers (3 files, 6 errors)

These use `(value: any) => ...` in `onValueChange` handlers.

| File | Errors | Fix Pattern |
|------|--------|-------------|
| `components/settings/preferences-tab.tsx` | 3 | Use string type directly |
| `components/settings/notifications-tab.tsx` | 1 | Use string type |
| `components/settings/household-personal-tab.tsx` | 2 | Use specific union types |

**Fix Pattern:**
```typescript
// Before
onValueChange={(value: any) => setPreferences({ ...preferences, dateFormat: value })}

// After  
onValueChange={(value: string) => setPreferences({ ...preferences, dateFormat: value })}
```

---

### Group 2: API Response Arrays (3 files, 17 errors)

These use `useState<any[]>([])` or callbacks with `any` params.

| File | Errors | Types Needed |
|------|--------|--------------|
| `components/transactions/quick-transaction-modal.tsx` | 10 | Account, BillInstance |
| `components/transactions/transaction-form.tsx` | 7 | Account, Bill, Category |
| `components/settings/household-tab.tsx` | 2 | HouseholdMember |

**Fix Pattern:**
```typescript
// Before
const [accounts, setAccounts] = useState<any[]>([]);
if (data.some((acc: any) => acc.id === defaults.accountId))

// After
import { Account } from '@/lib/types';
const [accounts, setAccounts] = useState<Account[]>([]);
if (data.some((acc: Account) => acc.id === defaults.accountId))
```

---

### Group 3: Saved Search Filters (2 files, 4 errors)

These use `Record<string, any>` for filter objects.

| File | Errors | Types Needed |
|------|--------|--------------|
| `components/transactions/saved-searches.tsx` | 3 | SearchFilters interface |
| `components/transactions/advanced-search.tsx` | 1 | SearchFilters interface |

**Fix Pattern:**
```typescript
// Before
filters: Record<string, any>

// After
import { SearchFilter } from '@/lib/types';
filters: SearchFilter
```

---

### Group 4: Rules System (3 files, 12 errors)

These use `any` for rule config objects and split updates.

| File | Errors | Types Needed |
|------|--------|--------------|
| `components/rules/rule-builder.tsx` | 8 | RuleActionConfig, SplitConfig |
| `components/rules/rules-manager.tsx` | 2 | Rule filtering |

**New Types Needed:**
```typescript
// Add to lib/types/index.ts
export interface SplitConfig {
  categoryId: string;
  amount: number;
  percentage: number;
  isPercentage: boolean;
  description: string;
}

export interface RuleActionConfig {
  splits?: SplitConfig[];
  targetAccountId?: string;
  description?: string;
  [key: string]: unknown;
}
```

**Fix Pattern:**
```typescript
// Before
const updateActionConfig = (index: number, config: any) => { ... }
const updateSplitField = (actionIndex: number, splitIndex: number, field: string, value: any) => { ... }

// After
const updateActionConfig = (index: number, config: RuleActionConfig) => { ... }
const updateSplitField = (
  actionIndex: number, 
  splitIndex: number, 
  field: keyof SplitConfig, 
  value: string | number | boolean
) => { ... }
```

---

### Group 5: Household/Settings Components (4 files, 6 errors)

These use `any` for member objects and permissions.

| File | Errors | Types Needed |
|------|--------|--------------|
| `components/settings/household-tab.tsx` | 2 | HouseholdMember |
| `components/settings/household-members-tab.tsx` | 2 | HouseholdMember |
| `components/settings/household-personal-tab.tsx` | 2 | Preference types |

**Fix Pattern:**
```typescript
// Before
.filter((m: any) => m.userId !== userId)

// After
import { HouseholdMember } from '@/lib/types';
.filter((m: HouseholdMember) => m.userId !== userId)
```

---

### Group 6: Onboarding Steps (6 files, 6 errors)

All use `handleSubmit = async (formData: any) => { ... }`

| File | Errors | Types Needed |
|------|--------|--------------|
| `components/onboarding/steps/create-account-step.tsx` | 1 | AccountFormData |
| `components/onboarding/steps/create-bill-step.tsx` | 1 | BillFormData |
| `components/onboarding/steps/create-category-step.tsx` | 1 | CategoryFormData |
| `components/onboarding/steps/create-debt-step.tsx` | 1 | DebtFormData |
| `components/onboarding/steps/create-goal-step.tsx` | 1 | GoalFormData |
| `components/onboarding/steps/create-transaction-step.tsx` | 1 | TransactionFormData |

**New Types Needed:**
```typescript
// Add to lib/types/index.ts
export interface BillFormData {
  name: string;
  categoryId?: string;
  merchantId?: string;
  amount: number;
  frequency: BillFrequency;
  dueDate: number;
  specificDueDate?: string;
  isAutoPay?: boolean;
  notes?: string;
}

export interface TransactionFormData {
  accountId: string;
  categoryId?: string;
  merchantId?: string;
  amount: number | string;
  type: TransactionType;
  date: string;
  description: string;
  notes?: string;
}
```

**Fix Pattern:**
```typescript
// Before
const handleSubmit = async (formData: any) => { ... }

// After
import { AccountFormData } from '@/lib/types';
const handleSubmit = async (formData: AccountFormData) => { ... }
```

---

### Group 7: Export/Report Components (1 file, 2 errors)

| File | Errors | Types Needed |
|------|--------|--------------|
| `components/reports/export-button.tsx` | 2 | ExportData interface |

**New Types Needed:**
```typescript
// Add to lib/types/index.ts
export interface ReportDataItem {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportData {
  data?: ReportDataItem[];
  [key: string]: unknown;
}

export interface ReportSummary {
  [key: string]: string | number;
}
```

**Fix Pattern:**
```typescript
// Before
interface ExportButtonProps {
  data: any;
  reportName: string;
  summary?: Record<string, any>;
}

// After
interface ExportButtonProps {
  data: ReportData | ReportDataItem[];
  reportName: string;
  summary?: ReportSummary;
}
```

---

### Group 8: Miscellaneous (4 files, 4 errors)

| File | Errors | Fix |
|------|--------|-----|
| `components/dev/debug-panel.tsx` | 1 | Use Record<string, unknown> |
| `components/household/activity-feed.tsx` | 1 | Use ActivityLogEntry |
| `components/offline/sync-status.tsx` | 1 | Use OfflineQueueItem |
| `components/transactions/transaction-details.tsx` | 1 | Use TransactionWithRelations |

---

## Implementation Order

### Step 1: Extend Type Definitions (lib/types/index.ts)
Add missing types:
- `SplitConfig` and `RuleActionConfig`
- `BillFormData` and `TransactionFormData`
- `ReportData` and `ReportSummary`

### Step 2: Fix Simple Event Handlers (Group 1)
- `preferences-tab.tsx` - 3 fixes
- `notifications-tab.tsx` - 1 fix
- `household-personal-tab.tsx` - 2 fixes
**Subtotal: 6 errors fixed**

### Step 3: Fix API Response Arrays (Group 2)
- `quick-transaction-modal.tsx` - 10 fixes
- `transaction-form.tsx` - 7 fixes
- `household-tab.tsx` - 2 fixes
**Subtotal: 19 errors fixed**

### Step 4: Fix Search Filter Types (Group 3)
- `saved-searches.tsx` - 3 fixes
- `advanced-search.tsx` - 1 fix
**Subtotal: 4 errors fixed**

### Step 5: Fix Rules System (Group 4)
- `rule-builder.tsx` - 8 fixes
- `rules-manager.tsx` - 2 fixes
**Subtotal: 10 errors fixed**

### Step 6: Fix Household Components (Group 5)
- `household-tab.tsx` - remaining fixes
- `household-members-tab.tsx` - 2 fixes
- `household-personal-tab.tsx` - remaining fixes
**Subtotal: 6 errors fixed**

### Step 7: Fix Onboarding Steps (Group 6)
- 6 onboarding step files - 1 fix each
**Subtotal: 6 errors fixed**

### Step 8: Fix Export/Report Components (Group 7)
- `export-button.tsx` - 2 fixes
**Subtotal: 2 errors fixed**

### Step 9: Fix Miscellaneous (Group 8)
- 4 files - 1 fix each
**Subtotal: 4 errors fixed**

### Step 10: Verification
- Run `pnpm eslint components/` - confirm 0 errors
- Run `pnpm build` - confirm successful build
- Update `docs/bugs.md` with completion status

---

## Type Definitions to Add

```typescript
// ============================================================================
// RULE ACTION CONFIG TYPES
// ============================================================================

export interface SplitConfig {
  categoryId: string;
  amount: number;
  percentage: number;
  isPercentage: boolean;
  description: string;
}

export interface RuleActionConfig {
  splits?: SplitConfig[];
  targetAccountId?: string;
  description?: string;
  [key: string]: unknown;
}

// ============================================================================
// FORM DATA TYPES
// ============================================================================

export interface BillFormData {
  name: string;
  categoryId?: string | null;
  merchantId?: string | null;
  amount: number | string;
  frequency: BillFrequency;
  dueDate: number;
  specificDueDate?: string;
  isAutoPay?: boolean;
  notes?: string;
  accountId?: string | null;
  isVariableAmount?: boolean;
  amountTolerance?: number;
  payeePatterns?: string;
}

export interface TransactionFormData {
  accountId: string;
  toAccountId?: string;
  categoryId?: string | null;
  merchantId?: string | null;
  amount: number | string;
  type: TransactionType;
  date: string;
  description: string;
  notes?: string;
  billId?: string | null;
  billInstanceId?: string | null;
  debtId?: string | null;
  isTaxDeductible?: boolean;
  isSalesTaxable?: boolean;
}

// ============================================================================
// REPORT EXPORT TYPES
// ============================================================================

export interface ReportDataItem {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportData {
  data?: ReportDataItem[];
  [key: string]: unknown;
}

export interface ReportSummary {
  [key: string]: string | number;
}
```

---

## Estimated Time

| Step | Files | Errors | Est. Time |
|------|-------|--------|-----------|
| 1. Add Types | 1 | - | 5 min |
| 2. Event Handlers | 3 | 6 | 10 min |
| 3. API Arrays | 3 | 19 | 20 min |
| 4. Search Filters | 2 | 4 | 5 min |
| 5. Rules System | 2 | 10 | 15 min |
| 6. Household | 3 | 6 | 10 min |
| 7. Onboarding | 6 | 6 | 15 min |
| 8. Export | 1 | 2 | 5 min |
| 9. Misc | 4 | 4 | 10 min |
| 10. Verify | - | - | 5 min |
| **Total** | **21** | **67** | **~100 min** |

---

## Success Criteria

1. ✅ `pnpm eslint components/` returns 0 errors
2. ✅ `pnpm build` completes successfully  
3. ✅ No new TypeScript errors introduced
4. ✅ `bugs.md` updated to mark Phase 2 as complete
5. ✅ `linter-phase2-plan.md` marked as complete

---

## Notes

- All existing types in `lib/types/index.ts` are well-documented and cover most entities
- New types follow the same naming conventions and documentation style
- No breaking changes to component APIs - only internal type improvements
- Prefer specific types over `unknown` where the structure is known

