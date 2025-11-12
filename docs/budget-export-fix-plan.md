# Budget Export Fix - Implementation Plan

## Problem Statement

**Bug:** Budget export shows $0 for income categories even when they have actual transactions (e.g., $1500 salary shows as $0 in export).

**Root Cause:** The `getBudgetDataForMonth` function in `lib/budgets/budget-export.ts` is hardcoded to only query transactions with `type = 'expense'` (line 95), completely ignoring income transactions.

## Issues Found

### Issue 1: Income Transactions Ignored ❌ CRITICAL
**Location:** `lib/budgets/budget-export.ts:95`
**Problem:**
```typescript
eq(transactions.type, 'expense'), // Always queries expense type
```
This means:
- Income categories show $0 actual (wrong!)
- Only expense/bill/savings categories show correct values

**Impact:** All income data missing from export

---

### Issue 2: Status Logic Not Reversed for Income ❌ FOUND
**Location:** `lib/budgets/budget-export.ts:109-118`
**Problem:**
```typescript
if (percentage >= 100) {
  status = 'Exceeded'; // For income, this should be GOOD, not bad
}
```
Same issue as the display bug we just fixed - income status logic is not reversed.

**Impact:** Export shows wrong sentiment for income categories

---

### Issue 3: Remaining Calculation Wrong for Income ❌ FOUND
**Location:** `lib/budgets/budget-export.ts:106`
**Problem:**
```typescript
const remaining = monthlyBudget - actualSpent;
```
For income:
- If budget is $5000 and actual is $6000
- Remaining = $5000 - $6000 = -$1000 (shows as negative)
- Should be +$1000 (extra income!)

**Impact:** Income "remaining" shows wrong sign in export

---

## Implementation Plan

### Task 1: Fix Transaction Type Query ✅
**File:** `lib/budgets/budget-export.ts`
**Lines:** 85-99 (transaction query)

**Changes:**
```typescript
// OLD (line 95):
eq(transactions.type, 'expense'),

// NEW:
eq(transactions.type, category.type === 'income' ? 'income' : 'expense'),
```

**Testing:**
- Income category with $1500 transactions → Shows $1500 in export
- Expense category with $2000 transactions → Shows $2000 in export
- Categories with $0 transactions → Shows $0 in export

---

### Task 2: Fix Status Logic for Income ✅
**File:** `lib/budgets/budget-export.ts`
**Lines:** 109-118 (status determination)

**Changes:**
```typescript
// Determine status based on category type
let status: string;
if (monthlyBudget === 0) {
  status = 'Unbudgeted';
} else {
  if (category.type === 'income') {
    // For income: exceeding is good, falling short is bad
    if (percentage >= 100) {
      status = 'Met Target'; // Meeting or exceeding income
    } else if (percentage >= 80) {
      status = 'On Track';
    } else if (percentage >= 50) {
      status = 'Below Target';
    } else {
      status = 'Severe Shortfall';
    }
  } else {
    // For expenses: original logic
    if (percentage >= 100) {
      status = 'Exceeded';
    } else if (percentage >= 80) {
      status = 'Warning';
    } else {
      status = 'On Track';
    }
  }
}
```

**Testing:**
- Income 120% → "Met Target" (good)
- Income 90% → "On Track"
- Income 70% → "Below Target"
- Income 40% → "Severe Shortfall"
- Expense 120% → "Exceeded" (bad)

---

### Task 3: Fix Remaining Calculation for Income ✅
**File:** `lib/budgets/budget-export.ts`
**Lines:** 106 (remaining calculation)

**Changes:**
```typescript
// Calculate remaining based on category type
const remaining = category.type === 'income'
  ? actualSpent - monthlyBudget // Income: positive if over target
  : monthlyBudget - actualSpent; // Expense: positive if under budget
```

**Testing:**
- Income: $6000 actual, $5000 budget → +$1000 remaining (extra income)
- Income: $4000 actual, $5000 budget → -$1000 remaining (income shortfall)
- Expense: $2000 actual, $2500 budget → +$500 remaining (under budget)
- Expense: $3000 actual, $2500 budget → -$500 remaining (over budget)

---

### Task 4: Update Summary Row Logic ✅
**File:** `lib/budgets/budget-export.ts`
**Lines:** 210-237 (summary row)

**Changes:**
No changes needed - summary row aggregates all categories correctly once individual category data is fixed.

**Testing:**
- Verify totals match sum of individual categories
- Verify summary percentage is correct

---

### Task 5: Add Income/Expense Separation to Summary (Optional Enhancement) ⏸️
**File:** `lib/budgets/budget-export.ts`

**Enhancement:**
Instead of one summary row, add three:
1. "TOTAL INCOME" - Sum of all income categories
2. "TOTAL EXPENSES" - Sum of all expense/bill/savings categories
3. "NET SURPLUS" - Income - Expenses

**Benefits:**
- Clearer financial picture
- Shows surplus/deficit clearly
- Matches how budgets are typically reviewed

**Implementation:**
Add after line 237:
```typescript
if (options.includeSummary) {
  // Separate income and expenses
  const incomeCategories = data.flatMap(m =>
    m.categories.filter(c => c.type === 'income')
  );
  const expenseCategories = data.flatMap(m =>
    m.categories.filter(c => c.type !== 'income')
  );

  const totalIncomeBudget = incomeCategories.reduce((s, c) => s + c.monthlyBudget, 0);
  const totalIncomeActual = incomeCategories.reduce((s, c) => s + c.actualSpent, 0);

  const totalExpenseBudget = expenseCategories.reduce((s, c) => s + c.monthlyBudget, 0);
  const totalExpenseActual = expenseCategories.reduce((s, c) => s + c.actualSpent, 0);

  const budgetedSurplus = totalIncomeBudget - totalExpenseBudget;
  const actualSurplus = totalIncomeActual - totalExpenseActual;

  rows.push(
    {
      Month: 'TOTAL',
      Category: 'Total Income',
      Type: 'Income Summary',
      Budgeted: totalIncomeBudget.toFixed(2),
      Actual: totalIncomeActual.toFixed(2),
      Remaining: (totalIncomeActual - totalIncomeBudget).toFixed(2),
      Percentage: totalIncomeBudget > 0 ? ((totalIncomeActual / totalIncomeBudget) * 100).toFixed(2) + '%' : '0%',
      Status: totalIncomeActual >= totalIncomeBudget ? 'Met Target' : 'Below Target',
      Daily_Avg: '',
      Projected_Month_End: '',
    },
    {
      Month: 'TOTAL',
      Category: 'Total Expenses',
      Type: 'Expense Summary',
      Budgeted: totalExpenseBudget.toFixed(2),
      Actual: totalExpenseActual.toFixed(2),
      Remaining: (totalExpenseBudget - totalExpenseActual).toFixed(2),
      Percentage: totalExpenseBudget > 0 ? ((totalExpenseActual / totalExpenseBudget) * 100).toFixed(2) + '%' : '0%',
      Status: totalExpenseActual <= totalExpenseBudget ? 'On Track' : 'Exceeded',
      Daily_Avg: '',
      Projected_Month_End: '',
    },
    {
      Month: 'TOTAL',
      Category: 'Net Surplus',
      Type: 'Net Summary',
      Budgeted: budgetedSurplus.toFixed(2),
      Actual: actualSurplus.toFixed(2),
      Remaining: (actualSurplus - budgetedSurplus).toFixed(2),
      Percentage: '',
      Status: actualSurplus >= budgetedSurplus ? 'On Track' : 'Below Target',
      Daily_Avg: '',
      Projected_Month_End: '',
    }
  );
}
```

---

## Testing Strategy

### Unit Testing Scenarios

**Income Categories:**
1. ✅ Income with transactions → Shows actual amount (not $0)
2. ✅ Income exceeding budget → "Met Target" status, positive remaining
3. ✅ Income below budget → "Below Target" status, negative remaining
4. ✅ Multiple income categories → All show correct values

**Expense Categories:**
1. ✅ Expense with transactions → Shows actual amount
2. ✅ Expense over budget → "Exceeded" status, negative remaining
3. ✅ Expense under budget → "On Track" status, positive remaining

**Summary Row:**
1. ✅ Totals match sum of categories
2. ✅ Percentage calculated correctly
3. ✅ Status reflects overall budget state

**Edge Cases:**
1. ✅ Categories with $0 budget → "Unbudgeted" status
2. ✅ Categories with $0 actual → Shows $0
3. ✅ Future months → Correct calculations
4. ✅ Past months → Correct calculations

### Manual Testing Checklist

**Setup Test Data:**
- [ ] Create income category "Salary" with $5000 budget
- [ ] Add $6000 in income transactions to "Salary"
- [ ] Create expense category "Groceries" with $500 budget
- [ ] Add $450 in expense transactions to "Groceries"
- [ ] Export budget for current month

**Verify Export:**
- [ ] Salary shows $6000 actual (not $0)
- [ ] Salary shows "Met Target" status (not "Exceeded")
- [ ] Salary shows +$1000 remaining (not -$1000)
- [ ] Groceries shows $450 actual
- [ ] Groceries shows "On Track" status
- [ ] Groceries shows +$50 remaining
- [ ] Summary row totals are correct
- [ ] All percentages calculated correctly

---

## Files to Modify

1. ✅ `lib/budgets/budget-export.ts` (~60 lines modified)
   - Fix transaction type query (line 95)
   - Fix status logic (lines 109-118)
   - Fix remaining calculation (line 106)
   - Optionally add income/expense separation to summary (lines 210-237)

**Total Estimated Changes:** ~60 lines in 1 file

---

## Build Verification

After implementation:
1. ✅ Run `pnpm build` to verify no TypeScript errors
2. ✅ Verify all 43 pages compile successfully
3. ✅ Test export with income and expense categories
4. ✅ Verify CSV data matches UI data

---

## Success Criteria

- ✅ Income categories show correct actual amounts in export
- ✅ Income status reflects correct sentiment (exceeding = good)
- ✅ Income remaining shows correct sign (positive for extra income)
- ✅ Expense categories continue to work correctly (unchanged behavior)
- ✅ Summary totals are accurate
- ✅ No TypeScript errors
- ✅ Export matches displayed budget data

---

## Rollback Plan

If issues arise:
1. Revert changes to `lib/budgets/budget-export.ts`
2. All changes are isolated to export functionality - no database changes
3. UI display continues to work correctly

---

## Timeline

- Task 1: Fix Transaction Type Query - 5 minutes
- Task 2: Fix Status Logic - 10 minutes
- Task 3: Fix Remaining Calculation - 5 minutes
- Task 4: Verify Summary Row - 5 minutes
- Task 5: Add Income/Expense Separation (Optional) - 15 minutes
- Testing & Verification - 15 minutes

**Total Estimated Time:** ~55 minutes (or ~40 minutes without optional task 5)

---

## Priority

**CRITICAL** - This bug makes the budget export feature unusable for users with income categories. All income data is missing from exports.

Fix tasks 1-4 immediately, consider task 5 as future enhancement.
