# Budget Income Display Logic Fix - Implementation Plan

## Problem Statement

**Bug:** Budget items for income categories are marking it as a bad thing when the actual amount goes above the budgeted amount. This is incorrect - exceeding budgeted income should be shown as positive (green), not negative (red).

**Current Behavior:**
- Income actual > budget → Shows red/error state (WRONG)
- Income actual < budget → Shows green/success state (WRONG)

**Desired Behavior:**
- Income actual > budget → Shows green/success state (GOOD - extra income!)
- Income actual < budget → Shows amber/warning or red/error state (BAD - income shortfall!)

## Root Cause Analysis

The budget system currently applies the same status logic to ALL category types:
1. **API Logic** (`app/api/budgets/overview/route.ts`):
   - Lines 136-146: Status calculation treats ≥100% as "exceeded" (red) for all categories
   - Lines 224-238: Adherence score penalizes going over budget for all categories

2. **Component Display** (`components/budgets/category-budget-progress.tsx`):
   - Lines 56-65: Progress bar colors follow API status (exceeded → red)
   - Lines 150-166: Shows "over budget" in red when remaining < 0
   - Lines 68-75: Pace warnings don't account for income reversal
   - Lines 197-206: Projections treat exceeding as bad

3. **Summary Card** (`components/budgets/budget-summary-card.tsx`):
   - Lines 96-119: Income section doesn't show variance indicators
   - Lines 32-39: Income percentage doesn't have proper color coding

## Implementation Plan

### Task 1: Update API Status Logic ✅
**File:** `app/api/budgets/overview/route.ts`
**Lines:** 136-146 (status determination)

**Changes:**
1. Add income-specific status logic:
   - Income ≥ 100% budget → `status = 'exceeded'` (but will be displayed as good)
   - Income 80-99% budget → `status = 'on_track'`
   - Income < 80% budget → `status = 'warning'`
   - Income < 50% budget → `status = 'critical'` (new status level)

2. Add a new field to CategoryBudgetStatus interface:
   - `isIncome: boolean` - Flag to identify income categories
   - OR use existing `type` field to check if type === 'income'

**Implementation Details:**
```typescript
// Determine status based on category type
let status: 'on_track' | 'warning' | 'exceeded' | 'unbudgeted' = 'unbudgeted';

if (monthlyBudget > 0) {
  if (category.type === 'income') {
    // For income: exceeding is good, falling short is bad
    if (percentage >= 100) {
      status = 'exceeded'; // Will be shown as green
    } else if (percentage >= 80) {
      status = 'on_track'; // On target
    } else if (percentage >= 50) {
      status = 'warning'; // Income shortfall
    } else {
      status = 'exceeded'; // Reuse exceeded for severe shortfall (will show red for income)
    }
  } else {
    // For expenses/savings: original logic
    if (percentage >= 100) {
      status = 'exceeded';
    } else if (percentage >= 80) {
      status = 'warning';
    } else {
      status = 'on_track';
    }
  }
}
```

**Testing:**
- Income at 120% budget → status = 'exceeded' (good)
- Income at 90% budget → status = 'on_track'
- Income at 70% budget → status = 'warning'
- Income at 40% budget → status = 'exceeded' (bad)
- Expenses at 120% → status = 'exceeded' (bad)

---

### Task 2: Fix Adherence Score Calculation ✅
**File:** `app/api/budgets/overview/route.ts`
**Lines:** 224-238 (adherence score)

**Changes:**
1. Reverse scoring logic for income categories:
   - Income actual ≥ budget → 100 points (meeting or exceeding is good!)
   - Income actual < budget → Penalize based on shortfall percentage

**Implementation Details:**
```typescript
for (const category of categoriesWithBudgets) {
  if (category.type === 'income') {
    // For income: meeting or exceeding budget is good
    if (category.actualSpent >= category.monthlyBudget) {
      // At or above income target = 100 points
      totalScore += 100;
    } else {
      // Below income target = penalize based on shortfall percentage
      const shortfallPercent = new Decimal(category.monthlyBudget)
        .minus(category.actualSpent)
        .div(category.monthlyBudget)
        .times(100)
        .toNumber();

      const score = Math.max(0, 100 - shortfallPercent);
      totalScore += score;
    }
  } else {
    // For expenses/savings: original logic
    if (category.actualSpent <= category.monthlyBudget) {
      totalScore += 100;
    } else {
      const overagePercent = new Decimal(category.actualSpent)
        .minus(category.monthlyBudget)
        .div(category.monthlyBudget)
        .times(100)
        .toNumber();

      const score = Math.max(0, 100 - overagePercent);
      totalScore += score;
    }
  }
}
```

**Testing:**
- Income: $5000 budgeted, $6000 actual → 100 points
- Income: $5000 budgeted, $4000 actual → 80 points (20% shortfall)
- Expense: $2000 budgeted, $1800 actual → 100 points

---

### Task 3: Update Category Progress Component Colors ✅
**File:** `components/budgets/category-budget-progress.tsx`
**Lines:** 56-65 (getProgressColor), 150-166 (remaining display)

**Changes:**

1. **Progress bar color function** (lines 56-65):
```typescript
const getProgressColor = () => {
  const isIncome = category.type === 'income';

  if (category.status === 'exceeded') {
    // For income: exceeded = good (green), for expenses: exceeded = bad (red)
    return isIncome ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]';
  } else if (category.status === 'warning') {
    return 'bg-[var(--color-warning)]';
  } else if (category.status === 'on_track') {
    return 'bg-[var(--color-success)]';
  }
  return 'bg-muted';
};
```

2. **Remaining/Over display** (lines 150-166):
```typescript
const isIncome = category.type === 'income';

// For income: negative remaining = extra income (good)
// For expenses: negative remaining = over budget (bad)
<span
  className={
    isIncome
      ? category.remaining >= 0
        ? 'text-[var(--color-warning)]' // Income shortfall
        : 'text-[var(--color-success)]' // Extra income!
      : category.remaining >= 0
      ? 'text-[var(--color-success)]' // Under budget
      : 'text-[var(--color-error)]' // Over budget
  }
>
  {isIncome
    ? category.remaining >= 0
      ? `$${category.remaining.toFixed(2)} below target`
      : `$${Math.abs(category.remaining).toFixed(2)} above target`
    : category.remaining >= 0
    ? `$${category.remaining.toFixed(2)} remaining`
    : `$${Math.abs(category.remaining).toFixed(2)} over`}
</span>
```

**Testing:**
- Income: $5000 budget, $6000 actual → Green progress bar, "above target" in green
- Expense: $2000 budget, $2500 actual → Red progress bar, "over" in red

---

### Task 4: Fix Pace and Projection Indicators ✅
**File:** `components/budgets/category-budget-progress.tsx`
**Lines:** 68-75 (pace check), 197-217 (projections)

**Changes:**

1. **Pace warning logic** (lines 68-75):
```typescript
const isIncome = category.type === 'income';

// For income: pace too LOW is bad, for expenses: pace too HIGH is bad
const isPaceTooHigh =
  daysRemaining > 0 &&
  category.budgetedDailyAverage > 0 &&
  (isIncome
    ? category.dailyAverage < category.budgetedDailyAverage * 0.8 // Income pace 20% below
    : category.dailyAverage > category.budgetedDailyAverage * 1.2); // Expense pace 20% above
```

2. **Projection display** (lines 197-217):
```typescript
const isIncome = category.type === 'income';

// Check if projected to exceed (meaning differs by type)
const isProjectedToExceed =
  category.monthlyBudget > 0 &&
  (isIncome
    ? category.projectedMonthEnd < category.monthlyBudget // Income shortfall
    : category.projectedMonthEnd > category.monthlyBudget); // Expense overage

{isProjectedToExceed && (
  <div className={`text-xs ${isIncome ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'}`}>
    {isIncome
      ? `Projected: $${category.projectedMonthEnd.toFixed(2)} (short by $${...})`
      : `Projected: $${category.projectedMonthEnd.toFixed(2)} (over by $${...})`}
  </div>
)}

{!isProjectedToExceed && category.projectedMonthEnd > 0 && (
  <div className="text-xs text-[var(--color-success)]">
    {isIncome
      ? `Projected: $${category.projectedMonthEnd.toFixed(2)} (above by $${...})`
      : `Projected: $${category.projectedMonthEnd.toFixed(2)} (under by $${...})`}
  </div>
)}
```

**Testing:**
- Income: Pace $150/day vs budgeted $200/day → Warning (pace too low)
- Expense: Pace $150/day vs budgeted $100/day → Warning (pace too high)

---

### Task 5: Add Income Variance to Summary Card ✅
**File:** `components/budgets/budget-summary-card.tsx`
**Lines:** 96-119 (income section)

**Changes:**
Add variance indicator to income section (similar to expenses):

```typescript
// Calculate income variance
const incomeVariance = new Decimal(summary.totalIncomeActual)
  .minus(summary.totalIncome)
  .toNumber();

// Determine income status (reversed from expenses)
const incomeStatus =
  incomePercentage >= 100
    ? 'ahead' // Meeting or exceeding income target (green)
    : incomePercentage >= 80
    ? 'on_track' // Close to target (green)
    : incomePercentage >= 50
    ? 'warning' // Significant shortfall (amber)
    : 'critical'; // Severe shortfall (red)

// In the income section JSX:
<div className="flex items-center justify-between mt-1">
  <span className="text-xs text-muted-foreground">
    {incomePercentage.toFixed(1)}%
  </span>
  {incomeVariance > 0 ? (
    <span className="text-xs text-[var(--color-success)]">
      ✓ Above target by ${Math.abs(incomeVariance).toFixed(2)}
    </span>
  ) : incomeVariance < 0 ? (
    <span className={`text-xs ${
      incomeStatus === 'critical'
        ? 'text-[var(--color-error)]'
        : 'text-[var(--color-warning)]'
    }`}>
      Below target by ${Math.abs(incomeVariance).toFixed(2)}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">On target</span>
  )}
</div>
```

**Progress Bar Colors:**
```typescript
<div
  className={`h-full transition-all duration-300 ${
    incomeStatus === 'ahead'
      ? 'bg-[var(--color-success)]'
      : incomeStatus === 'on_track'
      ? 'bg-[var(--color-income)]'
      : incomeStatus === 'warning'
      ? 'bg-[var(--color-warning)]'
      : 'bg-[var(--color-error)]'
  }`}
  style={{ width: `${Math.min(100, incomePercentage)}%` }}
/>
```

**Testing:**
- Income: $5000 budget, $6000 actual → Green bar, "Above target by $1000" in green
- Income: $5000 budget, $4500 actual → Green/blue bar, "Below target by $500" in amber
- Income: $5000 budget, $2000 actual → Red bar, "Below target by $3000" in red

---

## Testing Strategy

### Unit Testing Scenarios

**API Endpoint Tests:**
1. Income category at 120% → status = 'exceeded', displayed as green
2. Income category at 90% → status = 'on_track'
3. Income category at 70% → status = 'warning'
4. Income category at 40% → status should indicate severe concern
5. Expense category at 120% → status = 'exceeded', displayed as red
6. Adherence score with mixed categories

**Component Tests:**
1. Verify progress bar color changes based on category type
2. Verify "remaining" vs "above target" text
3. Verify pace indicators reverse for income
4. Verify projection warnings reverse for income
5. Verify summary card variance displays correctly

### Manual Testing Checklist

**Setup Test Data:**
- [ ] Create income category with $5000 budget
- [ ] Add $6000 in income transactions (120% of budget)
- [ ] Create expense category with $2000 budget
- [ ] Add $2500 in expense transactions (125% of budget)

**Verify Display:**
- [ ] Income category shows green progress bar (not red)
- [ ] Income shows "above target" in green (not "over budget" in red)
- [ ] Expense category shows red progress bar
- [ ] Expense shows "over budget" in red
- [ ] Adherence score accounts for income correctly
- [ ] Summary card shows income variance in appropriate colors
- [ ] Pace indicators work correctly for both types
- [ ] Projections display with correct sentiment

**Edge Cases:**
- [ ] Income at exactly 100% of budget
- [ ] Income at 0% of budget (no income received)
- [ ] Categories with $0 budget
- [ ] Future months (no days elapsed)
- [ ] Past months (all days elapsed)

---

## Files to Modify

1. ✅ `app/api/budgets/overview/route.ts` (~30 lines modified)
   - Status determination logic (lines 136-146)
   - Adherence score calculation (lines 224-238)

2. ✅ `components/budgets/category-budget-progress.tsx` (~80 lines modified)
   - getProgressColor function (lines 56-65)
   - Remaining display logic (lines 150-166)
   - Pace warning logic (lines 68-75)
   - Projection display (lines 197-217)

3. ✅ `components/budgets/budget-summary-card.tsx` (~40 lines modified)
   - Add income variance calculation (after line 39)
   - Add income status determination (after variance)
   - Add variance display to income section (lines 115-119)
   - Update progress bar colors (line 111)

**Total Estimated Changes:** ~150 lines across 3 files

---

## Build Verification

After implementation:
1. ✅ Run `pnpm build` to verify no TypeScript errors
2. ✅ Verify all 43 pages compile successfully
3. ✅ Test with both Dark Mode and Dark Pink themes
4. ✅ Verify no console errors or warnings

---

## Success Criteria

- ✅ Income categories show green when actual > budget
- ✅ Income categories show amber/red when actual < budget
- ✅ Expense categories continue to work correctly (unchanged behavior)
- ✅ Adherence score accounts for income direction correctly
- ✅ All text labels reflect correct sentiment (above target vs over budget)
- ✅ Pace and projection warnings reverse for income categories
- ✅ Summary card displays income variance with appropriate colors
- ✅ No TypeScript errors
- ✅ Full theme compatibility maintained

---

## Rollback Plan

If issues arise:
1. Revert changes to `app/api/budgets/overview/route.ts` (status + adherence)
2. Revert changes to `components/budgets/category-budget-progress.tsx`
3. Revert changes to `components/budgets/budget-summary-card.tsx`
4. All changes are isolated to budget display logic - no database changes required

---

## Timeline

- Task 1: API Status Logic - 15 minutes
- Task 2: Adherence Score - 10 minutes
- Task 3: Category Progress Colors - 20 minutes
- Task 4: Pace & Projections - 20 minutes
- Task 5: Summary Card Variance - 15 minutes
- Testing & Verification - 20 minutes

**Total Estimated Time:** ~100 minutes (1.5-2 hours)

---

## Notes

- This is purely a display logic fix - no database schema changes required
- All existing data remains valid
- Changes are isolated to budget components
- Uses existing CSS variables for theme compatibility
- Follows established patterns from expense logic
- Maintains Decimal.js usage for financial calculations
