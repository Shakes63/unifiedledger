# Budget Setup & Management Implementation Plan
**Phase 1 of Budget System**

## Executive Summary
This plan outlines the implementation of Phase 1: Budget Setup & Management from the budgetsystemplan.md. This will create the foundation for the comprehensive budget tracking system, allowing users to set monthly budgets for categories, view budget vs actual spending, and manage their budgets effectively.

## Current State Analysis

### What Already Exists
✅ **Database Schema:**
- `budgetCategories` table with `monthlyBudget` field
- Category types support (income, variable_expense, monthly_bill, savings, debt, non_monthly_bill)

✅ **API Endpoints:**
- `/api/budgets/check` - Check budget for a single category
- `/api/budgets/summary` - Overall budget summary with debt integration
- `/api/budgets/surplus-suggestion` - Suggest surplus allocation
- `/api/budgets/apply-surplus` - Apply surplus to debts

✅ **Components:**
- `budget-warning.tsx` - Real-time budget warnings during transaction entry
- `budget-surplus-card.tsx` - Dashboard widget showing surplus
- `debt-to-income-indicator.tsx` - DTI ratio display
- `apply-surplus-modal.tsx` - Modal for applying surplus to debts

✅ **Theme System:**
- Complete CSS variable system with semantic tokens
- Dark Mode (default) and Dark Pink Theme
- Comprehensive color palette for all UI states

### What Needs to Be Built
❌ **Dashboard Page:**
- `/app/dashboard/budgets/page.tsx` - Main budget overview page

❌ **Core Components:**
- Budget manager (set/edit budgets)
- Budget progress widget (visual progress bars)
- Category budget list
- Budget templates system
- Month selector/navigator

❌ **API Endpoints:**
- `/api/budgets` (GET) - List all budgets for a month
- `/api/budgets` (POST) - Create/update budget for category
- `/api/budgets/overview` (GET) - Comprehensive overview with all categories
- `/api/budgets/templates` (GET) - Budget template presets
- `/api/budgets/copy` (POST) - Copy budgets from previous month

## Implementation Plan

### Task 1: Create Budget Overview API Endpoint
**File:** `app/api/budgets/overview/route.ts`

**Purpose:** Comprehensive endpoint that returns all budget data for the overview dashboard.

**Response Structure:**
```typescript
{
  month: "2025-05",
  summary: {
    totalIncome: number,
    totalIncomeActual: number,
    totalExpenseBudget: number,
    totalExpenseActual: number,
    totalSavingsBudget: number,
    totalSavingsActual: number,
    budgetedSurplus: number,
    actualSurplus: number,
    adherenceScore: number, // 0-100
    daysInMonth: number,
    daysRemaining: number,
    daysElapsed: number
  },
  categories: Array<{
    id: string,
    name: string,
    type: 'income' | 'variable_expense' | 'monthly_bill' | 'savings' | 'debt' | 'non_monthly_bill',
    monthlyBudget: number,
    actualSpent: number,
    remaining: number,
    percentage: number,
    status: 'on_track' | 'warning' | 'exceeded' | 'unbudgeted',
    dailyAverage: number, // Actual spending per day
    budgetedDailyAverage: number, // Budgeted amount per day
    projectedMonthEnd: number, // Projection based on current rate
    isOverBudget: boolean
  }>,
  groupedCategories: {
    income: Array<Category>,
    expenses: Array<Category>,
    savings: Array<Category>,
    bills: Array<Category>
  }
}
```

**Logic:**
1. Accept month parameter (default to current month)
2. Fetch all active categories for user
3. For each category, calculate actual spending from transactions table
4. Calculate summary statistics
5. Calculate adherence score (average of all category scores)
6. Group categories by type for organized display
7. Calculate projections based on current spending rate

**Theme Integration:** None needed (API endpoint)

---

### Task 2: Create Budget CRUD API Endpoint
**File:** `app/api/budgets/route.ts`

**Purpose:** Handle creating and updating category budgets, bulk updates.

**Endpoints:**

**GET `/api/budgets?month=2025-05`**
- Returns all category budgets for specified month
- Currently uses `monthlyBudget` field in `budgetCategories` table
- Response: Array of categories with budget information

**POST/PUT `/api/budgets`**
- Update budget for one or more categories
- Request body:
```typescript
{
  month: "2025-05", // For future use
  budgets: Array<{
    categoryId: string,
    monthlyBudget: number
  }>
}
```
- Updates `monthlyBudget` field in `budgetCategories` table
- Returns updated categories

**Validation:**
- Budget amounts must be >= 0
- User must own categories
- Only update active categories

**Theme Integration:** None needed (API endpoint)

---

### Task 3: Create Budget Templates API Endpoint
**File:** `app/api/budgets/templates/route.ts`

**Purpose:** Provide budget template presets (50/30/20 rule, zero-based, etc.)

**GET `/api/budgets/templates`**
- Returns available budget templates

**Templates:**
1. **50/30/20 Rule**
   - 50% Needs (essential expenses, bills)
   - 30% Wants (discretionary spending)
   - 20% Savings & Debt

2. **Zero-Based Budget**
   - Every dollar assigned to a category
   - Income - Expenses - Savings = 0

3. **60% Solution**
   - 60% Committed expenses (bills, essentials)
   - 10% Retirement
   - 10% Long-term savings
   - 10% Short-term savings
   - 10% Fun money

**POST `/api/budgets/templates/apply`**
- Apply a template to user's budget
- Request body:
```typescript
{
  templateType: '50-30-20' | 'zero-based' | '60-solution',
  monthlyIncome: number
}
```
- Calculates budget for each category based on template
- Returns suggested budgets (doesn't save automatically)

**Theme Integration:** None needed (API endpoint)

---

### Task 4: Create Copy Previous Month API Endpoint
**File:** `app/api/budgets/copy/route.ts`

**Purpose:** Copy budgets from previous month to current month

**POST `/api/budgets/copy`**
- Request body:
```typescript
{
  fromMonth: "2025-04",
  toMonth: "2025-05"
}
```
- Copies `monthlyBudget` values from all categories
- Returns confirmation and count of budgets copied

**Logic:**
1. Fetch all categories with budgets from source month
2. Update same categories for target month
3. Handle any new categories (don't copy)
4. Return summary of changes

**Theme Integration:** None needed (API endpoint)

---

### Task 5: Create Budget Overview Dashboard Page
**File:** `app/dashboard/budgets/page.tsx`

**Purpose:** Main budget dashboard with summary, progress, and quick actions

**Layout Structure:**
```
┌─────────────────────────────────────────────────────┐
│ Budgets                          [◀ May 2025 ▶]    │
├─────────────────────────────────────────────────────┤
│ 📊 Monthly Summary                                  │
│ [Budget Summary Card Component]                     │
│ - Income vs Budgeted Income                        │
│ - Expenses vs Budgeted Expenses                    │
│ - Savings Rate                                      │
│ - Days Remaining in Month                          │
│ - Budget Adherence Score                           │
├─────────────────────────────────────────────────────┤
│ Quick Actions                                       │
│ [Set Budgets] [Copy Last Month] [Use Template ▼]  │
├─────────────────────────────────────────────────────┤
│ 💰 Category Budgets                                 │
│ [Filter: All ▼] [Sort: Name ▼]                    │
│                                                     │
│ Income                                              │
│ [Category Budget Progress Components]              │
│                                                     │
│ Essential Expenses                                  │
│ [Category Budget Progress Components]              │
│                                                     │
│ Discretionary Spending                             │
│ [Category Budget Progress Components]              │
│                                                     │
│ Savings & Goals                                     │
│ [Category Budget Progress Components]              │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Month navigation (previous/next month)
- Budget summary card showing overall status
- Quick action buttons
- Categorized budget list with progress bars
- Click category to edit budget inline
- Empty state when no budgets set

**Theme Integration:**
- `bg-background` - Page background
- `bg-card` - Card backgrounds
- `border-border` - Card borders
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `bg-elevated` - Hover states
- `bg-[var(--color-primary)]` - Primary action buttons
- `text-[var(--color-income)]` - Income amounts
- `text-[var(--color-expense)]` - Expense amounts
- `bg-[var(--color-success)]` - On-track progress bars
- `bg-[var(--color-warning)]` - Warning progress bars
- `bg-[var(--color-error)]` - Over-budget progress bars

**State Management:**
- useState for selected month
- useEffect to fetch budget overview on mount and month change
- Loading and error states

---

### Task 6: Create Budget Summary Card Component
**File:** `components/budgets/budget-summary-card.tsx`

**Purpose:** Display overall budget status for the month

**Props:**
```typescript
interface BudgetSummaryCardProps {
  summary: {
    totalIncome: number;
    totalIncomeActual: number;
    totalExpenseBudget: number;
    totalExpenseActual: number;
    totalSavingsBudget: number;
    totalSavingsActual: number;
    budgetedSurplus: number;
    actualSurplus: number;
    adherenceScore: number;
    daysInMonth: number;
    daysRemaining: number;
    daysElapsed: number;
  };
  month: string;
}
```

**Layout:**
```
┌──────────────────────────────────────────────┐
│ Monthly Summary - May 2025                   │
├──────────────────────────────────────────────┤
│ Income                                       │
│ $5,000 budgeted | $4,850 actual             │
│ [Progress bar: 97%]                          │
├──────────────────────────────────────────────┤
│ Expenses                                     │
│ $4,200 budgeted | $3,950 actual             │
│ [Progress bar: 94%] ✓ Under budget by $250  │
├──────────────────────────────────────────────┤
│ Savings                                      │
│ $800 budgeted | $900 actual                 │
│ [Progress bar: 112%] ✓ Ahead by $100        │
├──────────────────────────────────────────────┤
│ Budget Adherence: 92% • 15 days remaining   │
└──────────────────────────────────────────────┘
```

**Features:**
- Color-coded progress bars (green under budget, amber warning, red over)
- Show variance (over/under budget)
- Adherence score with label (Excellent 90-100, Good 70-89, Fair 50-69, Poor <50)
- Days remaining countdown
- Responsive layout (stacks on mobile)

**Theme Integration:**
- `bg-card` - Card background
- `border-border` - Card border
- `text-foreground` - Primary text
- `text-muted-foreground` - Labels
- `text-[var(--color-income)]` - Income values
- `text-[var(--color-expense)]` - Expense values
- `bg-[var(--color-success)]` - Under budget progress
- `bg-[var(--color-warning)]` - Near budget progress
- `bg-[var(--color-error)]` - Over budget progress

---

### Task 7: Create Category Budget Progress Component
**File:** `components/budgets/category-budget-progress.tsx`

**Purpose:** Display individual category budget with progress bar

**Props:**
```typescript
interface CategoryBudgetProgressProps {
  category: {
    id: string;
    name: string;
    type: string;
    monthlyBudget: number;
    actualSpent: number;
    remaining: number;
    percentage: number;
    status: 'on_track' | 'warning' | 'exceeded' | 'unbudgeted';
    dailyAverage: number;
    budgetedDailyAverage: number;
    projectedMonthEnd: number;
    isOverBudget: boolean;
  };
  onEdit: (categoryId: string) => void;
}
```

**Layout:**
```
┌──────────────────────────────────────────────┐
│ Groceries                        [Edit]      │
│ $600 / $700                                  │
│ [████████████░░░] 86%                        │
│ $100 remaining • 15 days left                │
│ Daily: $40 (budget: $23) ⚠️ Pace too high    │
│ Projected: $720 (over by $20)               │
└──────────────────────────────────────────────┘
```

**Features:**
- Click to edit budget inline
- Color-coded progress bar
- Show remaining amount and percentage
- Daily spending average vs budgeted
- Month-end projection based on current pace
- Warning indicators
- Empty state if no budget set

**Theme Integration:**
- `bg-card` - Card background
- `bg-elevated` - Hover state
- `border-border` - Border
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `bg-[var(--color-success)]` - On-track progress
- `bg-[var(--color-warning)]` - Warning progress
- `bg-[var(--color-error)]` - Exceeded progress
- `text-[var(--color-primary)]` - Edit button

---

### Task 8: Create Budget Manager Modal Component
**File:** `components/budgets/budget-manager-modal.tsx`

**Purpose:** Modal for setting/editing budgets for all categories at once

**Props:**
```typescript
interface BudgetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Array<{
    id: string;
    name: string;
    type: string;
    monthlyBudget: number;
  }>;
  onSave: (budgets: Array<{ categoryId: string; monthlyBudget: number }>) => void;
}
```

**Layout:**
```
┌──────────────────────────────────────────────┐
│ Set Monthly Budgets                    [×]   │
├──────────────────────────────────────────────┤
│ [Copy Last Month] [Use Template ▼]          │
├──────────────────────────────────────────────┤
│ Income Categories                            │
│ Salary                    [$5,000.00]        │
│ Side Income               [$0.00]            │
├──────────────────────────────────────────────┤
│ Fixed Expenses                               │
│ Rent                      [$1,500.00]        │
│ Car Payment               [$350.00]          │
│ Insurance                 [$200.00]          │
├──────────────────────────────────────────────┤
│ Variable Expenses                            │
│ Groceries                 [$700.00]          │
│ Gas                       [$150.00]          │
│ Dining Out                [$200.00]          │
├──────────────────────────────────────────────┤
│ Savings & Goals                              │
│ Emergency Fund            [$500.00]          │
│ Vacation                  [$300.00]          │
├──────────────────────────────────────────────┤
│ Summary                                      │
│ Total Income:   $5,000                       │
│ Total Expenses: $4,200                       │
│ Total Savings:  $800                         │
│ Surplus/Deficit: $0 ✓                        │
├──────────────────────────────────────────────┤
│              [Cancel] [Save Budget]          │
└──────────────────────────────────────────────┘
```

**Features:**
- Group categories by type
- Number inputs for each category budget
- Real-time summary calculation
- Show surplus/deficit (income - expenses - savings)
- Copy from previous month button
- Template dropdown (50/30/20, zero-based, etc.)
- Validation (highlight if income < expenses + savings)
- Save all changes at once

**Theme Integration:**
- `bg-card` - Modal background
- `bg-background` - Overlay background with opacity
- `border-border` - Borders and dividers
- `text-foreground` - Primary text
- `text-muted-foreground` - Labels
- `bg-input` - Input backgrounds
- `bg-[var(--color-primary)]` - Save button
- `text-[var(--color-success)]` - Surplus indicator
- `text-[var(--color-error)]` - Deficit indicator

---

### Task 9: Create Budget Template Selector Component
**File:** `components/budgets/budget-template-selector.tsx`

**Purpose:** Dropdown to select and apply budget templates

**Props:**
```typescript
interface BudgetTemplateSelectorProps {
  monthlyIncome: number;
  categories: Array<Category>;
  onApplyTemplate: (budgets: Array<{ categoryId: string; monthlyBudget: number }>) => void;
}
```

**Templates:**
1. **50/30/20 Rule**
   - 50% to needs (bills, essential expenses)
   - 30% to wants (discretionary)
   - 20% to savings & debt

2. **Zero-Based**
   - Allocate every dollar
   - Income = Expenses + Savings

3. **60% Solution**
   - 60% committed expenses
   - 10% retirement
   - 10% long-term savings
   - 10% short-term savings
   - 10% fun money

**Features:**
- Dropdown menu with template options
- Modal explaining template before applying
- Automatically categorize user's categories into template buckets
- Show preview before applying
- Ability to adjust after applying

**Theme Integration:**
- `bg-card` - Dropdown background
- `bg-elevated` - Hover states
- `border-border` - Borders
- `text-foreground` - Text
- `text-muted-foreground` - Descriptions

---

### Task 10: Add Navigation Link to Budgets Page
**File:** `components/navigation/sidebar.tsx` and mobile nav

**Purpose:** Add "Budgets" link to sidebar and mobile navigation

**Changes:**
- Add "Budgets" menu item between "Bills" and "Goals" (or appropriate location)
- Icon: Use existing icon system (e.g., calculator, chart-bar, or coin)
- Link to `/dashboard/budgets`
- Highlight when active

**Theme Integration:**
- Follow existing navigation theme patterns
- `bg-elevated` for active state
- `text-foreground` for text
- `text-[var(--color-primary)]` for active text/icon

---

### Task 11: Integration Testing & Polish

**Testing:**
1. Test budget overview loads correctly
2. Test month navigation (previous/next)
3. Test setting budgets for categories
4. Test copy from previous month
5. Test template application
6. Test inline category budget editing
7. Test real-time summary calculations
8. Test progress bars and status indicators
9. Test responsive design (mobile, tablet, desktop)
10. Test with empty state (no budgets set)
11. Test with various budget scenarios (over, under, on-track)
12. Test theme switching (Dark Mode ↔ Dark Pink Theme)

**Edge Cases:**
- No categories exist
- No budgets set
- First month (can't copy previous)
- Income is zero
- All budgets exceeded
- Decimal amounts
- Large numbers
- Negative budgets (validation should prevent)

**Polish:**
- Add loading skeletons
- Add error states with retry
- Add success toasts on save
- Add confirmation dialogs for destructive actions
- Smooth animations for progress bars
- Keyboard navigation support
- Accessibility (ARIA labels, focus management)

---

## Implementation Order

### Day 1: API Foundation
1. Task 1: Budget Overview API (`/api/budgets/overview`)
2. Task 2: Budget CRUD API (`/api/budgets`)
3. Task 4: Copy Previous Month API (`/api/budgets/copy`)

### Day 2: API Templates & Components Start
4. Task 3: Budget Templates API (`/api/budgets/templates`)
5. Task 6: Budget Summary Card Component
6. Task 7: Category Budget Progress Component

### Day 3: Main UI & Manager
7. Task 5: Budget Overview Dashboard Page
8. Task 8: Budget Manager Modal Component
9. Task 9: Budget Template Selector Component

### Day 4: Integration & Polish
10. Task 10: Add Navigation Links
11. Task 11: Testing & Polish

## Success Criteria

### Functionality
- ✅ Users can view budget overview for any month
- ✅ Users can set/edit budgets for all categories
- ✅ Users can copy budgets from previous month
- ✅ Users can apply budget templates
- ✅ Real-time progress tracking works correctly
- ✅ Budget adherence score calculates accurately
- ✅ Projections based on current spending rate

### UX
- ✅ Intuitive budget setup flow
- ✅ Clear visual indicators (progress bars, colors)
- ✅ Quick actions easily accessible
- ✅ Responsive on all devices
- ✅ Fast loading and smooth interactions

### Design
- ✅ Consistent with existing app design
- ✅ Uses theme variables throughout
- ✅ Works with both Dark Mode and Dark Pink Theme
- ✅ Follows 12px border radius convention
- ✅ Proper spacing and typography

### Performance
- ✅ Page loads in < 1 second
- ✅ API responses in < 500ms
- ✅ Smooth animations (60fps)
- ✅ No layout shifts

## Future Enhancements (Post Phase 1)

After Phase 1 is complete, subsequent phases will add:
- **Phase 2:** Real-time tracking during transaction entry (already partially exists)
- **Phase 3:** Variable bill tracking with historical analysis
- **Phase 4:** Budget analytics with charts and trends
- **Phase 5:** Advanced features (rollover, bi-weekly budgets, forecasting)

## Notes

### Database Considerations
- Currently using `monthlyBudget` field in `budgetCategories` table
- This means budgets are the same every month
- For historical tracking, we could add `monthly_budgets` table later
- For Phase 1, we'll use the existing schema and accept that budgets are consistent month-to-month
- Future enhancement: Add historical budget tracking table

### Decimal.js Usage
- Always use `Decimal.js` for financial calculations
- Convert to number only for display
- Prevent floating-point errors

### Performance
- Use Drizzle ORM's batch queries where possible
- Cache budget calculations on the frontend
- Debounce inline editing inputs
- Use React.memo for category budget components

### Accessibility
- Keyboard navigation for all interactive elements
- ARIA labels for screen readers
- Focus management in modals
- Color is not the only indicator (use icons + text)

---

## Appendix: Theme Color Reference

### Background Colors
- `bg-background` - Main page background
- `bg-card` - Card backgrounds
- `bg-elevated` - Hover states, elevated surfaces
- `bg-input` - Input backgrounds

### Text Colors
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `text-card-foreground` - Text on cards

### Border Colors
- `border-border` - All borders

### Semantic Colors
- `text-[var(--color-income)]` - Income (green/turquoise)
- `text-[var(--color-expense)]` - Expense (red/pink)
- `bg-[var(--color-success)]` - Success states
- `bg-[var(--color-warning)]` - Warning states
- `bg-[var(--color-error)]` - Error states
- `bg-[var(--color-primary)]` - Primary actions (pink)

### Progress Bar Colors
- On-track (0-79%): `bg-[var(--color-success)]`
- Warning (80-99%): `bg-[var(--color-warning)]`
- Exceeded (100%+): `bg-[var(--color-error)]`

---

**Plan Created:** 2025-11-09
**Phase:** 1 - Budget Setup & Management
**Estimated Completion:** 4 days
**Dependencies:** None (all prerequisites exist)
