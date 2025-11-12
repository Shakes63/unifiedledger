# Income Frequency Implementation Plan

## Objective
Add an income frequency field to transactions to enable accurate budget tracking for income that comes in at regular intervals (weekly, biweekly, monthly) instead of using inaccurate daily averages. Variable frequency income will continue using daily average calculations.

## Problem Statement
Currently, the budget system calculates daily averages for all income by dividing actual income by days elapsed. This is inaccurate for regular income like:
- **Monthly salary**: $3000/month shows as $100/day after 3 days, projecting $3000 total (accurate), but misleading before payday
- **Biweekly paycheck**: $1500 every 2 weeks appears erratic in daily tracking
- **Weekly wages**: $500/week shows inconsistent daily progress

Users need frequency-based tracking that understands income patterns and provides accurate projections.

## Current Architecture

### Budget Calculations (`app/api/budgets/overview/route.ts`)
- Lines 120-122: Daily average = `actualSpent / daysElapsed`
- Lines 129-133: Projected month-end = `actualSpent + (dailyAverage × daysRemaining)`
- Works for variable expenses but not for predictable income

### Transaction Schema (`lib/db/schema.ts`)
- Currently no income frequency field
- Has `isRecurring` and `recurringRule` but not structured for frequency-based budgeting

### Transaction Form (`components/transactions/transaction-form.tsx`)
- Income transactions currently have same fields as expenses
- No frequency selector for income

## Solution Design

### Frequency Options
1. **Weekly** - Income received every week (52 times/year)
2. **Biweekly** - Income received every 2 weeks (26 times/year)
3. **Monthly** - Income received once per month (12 times/year)
4. **Variable** - Irregular income, use daily average (default behavior)

### Frequency-Based Budget Logic

For frequency-based income:
- **Expected Income This Month** = Calculate based on frequency and dates
- **Daily Average** = N/A (hide this metric for non-variable income)
- **Projection** = Expected income based on frequency, not extrapolated from partial data

Example calculations:
- **Monthly ($3000)**: If today is the 10th and payday is 15th:
  - If payment hasn't happened yet: Expected = $3000, Actual = $0
  - If payment happened: Expected = $3000, Actual = $3000

- **Biweekly ($1500)**: If paydays are 1st and 15th:
  - Before 1st: Expected = $3000, Actual = $0
  - After 1st, before 15th: Expected = $3000, Actual = $1500
  - After both: Expected = $3000, Actual = $3000

- **Weekly ($500)**: Count Fridays in month (4 or 5):
  - Expected = $500 × number of Fridays
  - Actual = sum of received payments

- **Variable**: Keep existing daily average logic

### Storage Approach

**Option A: Category-Level Frequency** (RECOMMENDED)
- Add `incomeFrequency` to `budgetCategories` table
- Simpler: All transactions in "Salary" category inherit "monthly" frequency
- More intuitive: Users think "my salary comes monthly" not "each transaction is monthly"
- Easier budget setup: Set once per category

**Option B: Transaction-Level Frequency**
- Add `incomeFrequency` to `transactions` table
- More flexible but more complex
- User has to set frequency per transaction
- Could lead to inconsistent data

**Decision: Use Option A (Category-Level)**

## Implementation Tasks

### Task 1: Database Migration - Add incomeFrequency to budgetCategories
**File**: `drizzle/0025_add_income_frequency.sql` (NEW)
**Estimated Lines**: ~20 lines

```sql
-- Add income frequency column to budget_categories
ALTER TABLE budget_categories ADD COLUMN income_frequency TEXT DEFAULT 'variable';

-- Valid values: 'weekly', 'biweekly', 'monthly', 'variable'
-- Default to 'variable' for existing categories (maintains current behavior)
```

**Schema Update** (`lib/db/schema.ts`):
```typescript
export const budgetCategories = sqliteTable('budget_categories', {
  // ... existing fields ...
  incomeFrequency: text('income_frequency', {
    enum: ['weekly', 'biweekly', 'monthly', 'variable'],
  }).default('variable'),
});
```

### Task 2: Update Budget Calculation Logic
**File**: `app/api/budgets/overview/route.ts`
**Estimated Lines**: ~100 lines modified/added

**New Helper Function** (add at top of file):
```typescript
function calculateExpectedIncome(
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'variable',
  monthlyBudget: number,
  year: number,
  month: number,
  actualReceived: number,
  daysElapsed: number
): {
  expectedThisMonth: number;
  shouldUseFrequency: boolean;
  projectedMonthEnd: number;
} {
  if (frequency === 'variable' || !frequency) {
    // Use existing daily average logic
    const dailyAvg = daysElapsed > 0 ? actualReceived / daysElapsed : 0;
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed);
    return {
      expectedThisMonth: monthlyBudget,
      shouldUseFrequency: false,
      projectedMonthEnd: actualReceived + (dailyAvg * daysRemaining),
    };
  }

  // For frequency-based income, expected = budget (assumes full amount will come)
  return {
    expectedThisMonth: monthlyBudget,
    shouldUseFrequency: true,
    projectedMonthEnd: monthlyBudget, // Project full budget amount
  };
}
```

**Update Main Logic** (around line 90-150):
- Fetch category with `incomeFrequency`
- Call `calculateExpectedIncome()` for income categories
- Update status determination to use frequency-aware logic
- Hide daily average display for non-variable income in response

**Response Interface Update**:
```typescript
interface CategoryBudgetStatus {
  // ... existing fields ...
  incomeFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'variable';
  shouldShowDailyAverage: boolean; // false for non-variable income
}
```

### Task 3: Update Category Budget Progress Component
**File**: `components/budgets/category-budget-progress.tsx`
**Estimated Lines**: ~40 lines modified

**Changes**:
- Conditionally hide daily average section when `!shouldShowDailyAverage`
- Update projection text for frequency-based income:
  - Instead of: "At this pace, you'll receive $X by month end"
  - Show: "Expected this month: $X (monthly income)" or similar
- Add frequency badge indicator (e.g., "Monthly Income", "Biweekly Income")

### Task 4: Update Budget Manager Modal
**File**: `components/budgets/budget-manager-modal.tsx`
**Estimated Lines**: ~80 lines added

**Add Frequency Selector for Income Categories**:
```tsx
{category.type === 'income' && (
  <div>
    <Label htmlFor={`frequency-${category.id}`}>Income Frequency</Label>
    <Select
      value={frequencies[category.id] || 'variable'}
      onValueChange={(value) => setFrequency(category.id, value)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="weekly">Weekly</SelectItem>
        <SelectItem value="biweekly">Biweekly (Every 2 weeks)</SelectItem>
        <SelectItem value="monthly">Monthly</SelectItem>
        <SelectItem value="variable">Variable (use daily average)</SelectItem>
      </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground mt-1">
      How often do you receive this income?
    </p>
  </div>
)}
```

**State Management**:
- Add `frequencies` state: `Record<string, string>`
- Load frequencies when modal opens
- Save frequencies when saving budgets

### Task 5: Update Budget API Endpoints
**File**: `app/api/budgets/route.ts`
**Estimated Lines**: ~20 lines modified

**POST/PUT Endpoints**:
- Accept `incomeFrequency` in request body
- Validate frequency values
- Save to database

```typescript
// In POST/PUT handlers
if (type === 'income' && incomeFrequency) {
  const validFrequencies = ['weekly', 'biweekly', 'monthly', 'variable'];
  if (!validFrequencies.includes(incomeFrequency)) {
    return Response.json(
      { error: 'Invalid income frequency' },
      { status: 400 }
    );
  }
  // Include in database insert/update
}
```

### Task 6: Update Category Form
**File**: `app/dashboard/categories/page.tsx`
**Estimated Lines**: ~60 lines added

**Add Frequency Selector to Category Creation/Edit**:
- Show frequency selector when category type is 'income'
- Default to 'variable'
- Save with category data

### Task 7: Update Budget Templates
**File**: `app/api/budgets/templates/route.ts`
**Estimated Lines**: ~10 lines modified

**Update Template Generation**:
- Set appropriate default frequencies for income categories in templates
- 50/30/20: Income categories get 'monthly' as sensible default
- Allow users to adjust after applying template

### Task 8: Update Budget Summary Card
**File**: `components/budgets/budget-summary-card.tsx`
**Estimated Lines**: ~20 lines modified

**Income Variance Display**:
- Update text to reflect frequency-based expectations
- "Monthly income on track" vs "Variable income below target"

### Task 9: Update Documentation
**Files**: `docs/features.md`, `.claude/CLAUDE.md`
**Estimated Lines**: ~100 lines

- Mark feature #2 as complete
- Add session summary
- Document frequency options
- Explain calculation logic

### Task 10: Build Verification & Testing
**Commands**: `pnpm build`

**Test Scenarios**:
1. ✅ Create income category with monthly frequency
2. ✅ Add monthly budget amount
3. ✅ Add income transaction before month-end
4. ✅ Verify projection shows full budget, not extrapolated
5. ✅ Verify daily average hidden for non-variable income
6. ✅ Test all 4 frequency types
7. ✅ Verify variable frequency uses existing logic
8. ✅ Check budget export includes frequency
9. ✅ Verify templates set sensible defaults

## Technical Specifications

### Database Schema
```typescript
// budgetCategories table
{
  incomeFrequency: 'weekly' | 'biweekly' | 'monthly' | 'variable'
}
```

### API Response Format
```typescript
{
  categories: [
    {
      id: string,
      name: string,
      type: 'income',
      monthlyBudget: number,
      actualSpent: number,
      incomeFrequency: 'monthly',
      shouldShowDailyAverage: false,
      projectedMonthEnd: number,
      // ... other fields
    }
  ]
}
```

### UI Components
- **Frequency Badge**: Pill showing "Monthly", "Biweekly", "Weekly", "Variable"
- **Frequency Selector**: Dropdown in budget manager and category form
- **Conditional Display**: Hide daily average for non-variable income
- **Updated Projection Text**: Frequency-aware messaging

## Design Considerations

### Why Not Transaction-Level Frequency?
- **Complexity**: Every transaction would need frequency set
- **Inconsistency**: User could forget to set frequency
- **Redundancy**: All transactions in "Salary" are monthly
- **Category-Level Makes Sense**: Income frequency is a property of the income source, not individual transactions

### Why Default to 'variable'?
- **Backward Compatibility**: Existing categories maintain current behavior
- **Safe Default**: Variable frequency preserves daily average logic
- **User Opt-In**: Users explicitly choose frequency-based tracking

### Future Enhancements (Out of Scope)
- Payroll calendar integration (specific pay dates)
- Partial period calculations (started job mid-month)
- Multiple frequencies per category (rare but possible)
- Automatic frequency detection from transaction patterns
- Weekly/biweekly pay date tracking (which day of week/biweek period)

## Success Criteria
1. ✅ Users can set income frequency per category (4 options)
2. ✅ Budget calculations use frequency for projections (not daily average)
3. ✅ Daily average hidden for non-variable income
4. ✅ Frequency badge displayed in budget UI
5. ✅ Backward compatible (existing categories default to 'variable')
6. ✅ All budget pages updated (overview, manager, category form)
7. ✅ Templates set sensible defaults
8. ✅ Zero TypeScript errors
9. ✅ Production build successful
10. ✅ Theme variables used throughout

## Estimated Completion Time
- Task 1: 20 minutes (migration)
- Task 2: 45 minutes (calculation logic)
- Task 3: 30 minutes (budget progress component)
- Task 4: 40 minutes (budget manager modal)
- Task 5: 20 minutes (API endpoints)
- Task 6: 30 minutes (category form)
- Task 7: 15 minutes (templates)
- Task 8: 15 minutes (summary card)
- Task 9: 15 minutes (documentation)
- Task 10: 30 minutes (testing)
- **Total**: ~4 hours

## Files to Create/Modify
1. **CREATE**: `drizzle/0025_add_income_frequency.sql` (~20 lines)
2. **MODIFY**: `lib/db/schema.ts` (~10 lines)
3. **MODIFY**: `app/api/budgets/overview/route.ts` (~100 lines)
4. **MODIFY**: `components/budgets/category-budget-progress.tsx` (~40 lines)
5. **MODIFY**: `components/budgets/budget-manager-modal.tsx` (~80 lines)
6. **MODIFY**: `app/api/budgets/route.ts` (~20 lines)
7. **MODIFY**: `app/dashboard/categories/page.tsx` (~60 lines)
8. **MODIFY**: `app/api/budgets/templates/route.ts` (~10 lines)
9. **MODIFY**: `components/budgets/budget-summary-card.tsx` (~20 lines)
10. **MODIFY**: `docs/features.md` (~10 lines)
11. **MODIFY**: `.claude/CLAUDE.md` (~90 lines)

**Total Estimated Lines**: ~460 lines (20 new, 440 modified)
