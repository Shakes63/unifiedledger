# Bug Fix: Monthly Bill Category Displays in Two Budget Sections

## Problem Statement
On the Budgets page (`/dashboard/budgets`), categories with type "Monthly Bill" (like Rent) appear in both "Essential Expenses" AND "Discretionary Spending" sections. The category should only appear in one section.

## Root Cause Analysis

Located in `/app/api/budgets/overview/route.ts`:

### Issue 1: `expenseCategories` includes bill types (lines 246-250)
```typescript
const expenseCategories = categoryStatuses.filter(c =>
  c.type === 'variable_expense' ||
  c.type === 'monthly_bill' ||      // Problem: includes monthly_bill
  c.type === 'non_monthly_bill'      // Problem: includes non_monthly_bill
);
```

### Issue 2: `groupedCategories.expenses` includes bill types (line 344)
```typescript
const groupedCategories = {
  income: incomeCategories.sort(...),
  expenses: expenseCategories.sort(...),  // Contains monthly_bill and non_monthly_bill
  savings: savingsCategories.sort(...),
  bills: categoryStatuses
    .filter(c => c.type === 'monthly_bill' || c.type === 'non_monthly_bill')  // Same items!
    .sort(...),
};
```

**Result:** Both `expenses` and `bills` contain `monthly_bill` and `non_monthly_bill` types.

### How the frontend displays it:
- `groupedCategories.bills` → "Essential Expenses" section
- `groupedCategories.expenses` → "Discretionary Spending" section

**Categories appear in BOTH sections because they exist in both arrays.**

## Fix Strategy

The fix must preserve backward compatibility with the summary calculations while correcting the grouped display:

1. **Keep `expenseCategories` with all expense types** for summary calculations (total expense budget/actual)
2. **Create a separate `discretionaryCategories`** filter for `variable_expense` only
3. **Update `groupedCategories.expenses`** to use `discretionaryCategories` instead of `expenseCategories`

## Step-by-Step Implementation

### Step 1: Add new filter for discretionary categories (after line 251)
```typescript
// Separate discretionary expenses from bill categories for display grouping
const discretionaryCategories = categoryStatuses.filter(c => c.type === 'variable_expense');
```

### Step 2: Update groupedCategories (lines 342-349)
```typescript
// Group categories by type for organized display
const groupedCategories = {
  income: incomeCategories.sort((a, b) => a.name.localeCompare(b.name)),
  expenses: discretionaryCategories.sort((a, b) => a.name.localeCompare(b.name)),  // Changed!
  savings: savingsCategories.sort((a, b) => a.name.localeCompare(b.name)),
  bills: categoryStatuses
    .filter(c => c.type === 'monthly_bill' || c.type === 'non_monthly_bill')
    .sort((a, b) => a.name.localeCompare(b.name)),
};
```

## Files to Modify

1. **`/app/api/budgets/overview/route.ts`** - Only file needing changes

## Testing Plan

1. Create or verify existence of categories with different types:
   - `income` type (e.g., Salary)
   - `monthly_bill` type (e.g., Rent, Utilities)
   - `non_monthly_bill` type (e.g., Annual Insurance)
   - `variable_expense` type (e.g., Groceries, Entertainment)
   - `savings` type (e.g., Emergency Fund)

2. Navigate to `/dashboard/budgets`

3. Verify:
   - "Income" section shows only income categories
   - "Essential Expenses" section shows only `monthly_bill` and `non_monthly_bill` categories
   - "Discretionary Spending" section shows only `variable_expense` categories
   - "Savings & Goals" section shows only savings categories
   - No category appears in multiple sections

4. Verify summary calculations remain correct:
   - Total Expense Budget should still include ALL expense types (variable + bills)
   - Total Expense Actual should still include ALL expense types

## Rollback Plan

If issues arise, revert the single file change in `/app/api/budgets/overview/route.ts`.

## Estimated Effort

- Implementation: 5 minutes
- Testing: 10 minutes
- Total: 15 minutes

## Risk Assessment

**Low Risk:**
- Single file change
- No database modifications
- No schema changes
- Summary calculations remain unchanged (only display grouping is fixed)
- Easy rollback

