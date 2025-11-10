# Budget Tracking System Plan

## Implementation Status

**Last Updated:** 2025-11-09 (All Phases 1-5 COMPLETE)

**🎉 Budget Tracking System: 100% Complete**
All five phases of the budget tracking system have been successfully implemented, tested, and integrated into the application.

### ✅ Phase 1: Budget Setup & Management - COMPLETE
- Implementation completed on 2025-11-09
- See `docs/budget-setup-completion-summary.md` for full details
- See `docs/budget-setup-implementation-plan.md` for implementation plan

### ✅ Phase 2: Real-Time Tracking - COMPLETE
- Implementation completed on 2025-11-09
- Budget warnings during transaction entry ✅ COMPLETE
- Budget overview dashboard page ✅ COMPLETE
- Budget progress widgets ✅ COMPLETE
- Real-time spending calculations ✅ COMPLETE
- Color-coded status indicators ✅ COMPLETE
- Projections (daily rate, month-end forecast) ✅ COMPLETE
- Dashboard budget summary widget ✅ COMPLETE

### ✅ Phase 3: Variable Bill Tracking - COMPLETE
- Implementation completed on 2025-11-09
- See `docs/variable-bill-tracking-plan.md` for implementation plan
- Variable bill API endpoint ✅ COMPLETE
- VariableBillCard component ✅ COMPLETE
- VariableBillTracker component ✅ COMPLETE
- Integration into Budget Dashboard ✅ COMPLETE
- Historical averages (3, 6, 12-month) ✅ COMPLETE
- Trend analysis and recommendations ✅ COMPLETE
- Inline editing of expected amounts ✅ COMPLETE
- Savings/overage highlighting ✅ COMPLETE

### ✅ Phase 4: Analytics & Insights - COMPLETE
- Implementation completed on 2025-11-09
- See `docs/budget-analytics-implementation-plan.md` for implementation plan
- Budget analytics API endpoint ✅ COMPLETE
- BudgetAnalyticsChart component (monthly trends) ✅ COMPLETE
- CategoryTrendChart component (category analysis) ✅ COMPLETE
- BudgetAnalyticsSection component (main container) ✅ COMPLETE
- Integration into Budget Dashboard ✅ COMPLETE
- Month-over-month comparison charts ✅ COMPLETE
- Category spending trends (3, 6, 12 months) ✅ COMPLETE
- Budget adherence scoring ✅ COMPLETE
- Overspending categories ranking ✅ COMPLETE
- Savings rate calculation and quality labels ✅ COMPLETE
- Intelligent recommendations system ✅ COMPLETE

### ✅ Phase 5: Integration & Polish - COMPLETE
- Implementation completed on 2025-11-09
- See `docs/budget-phase5-implementation-plan.md` for implementation plan
- Budget warnings to transaction form ✅ Already exists
- Budget surplus card on dashboard ✅ Already exists
- Debt-to-income integration ✅ Already exists
- Monthly budget review notifications ✅ COMPLETE
- Export budget data (CSV) ✅ COMPLETE

---

## Overview
Build a comprehensive budgeting system that allows users to set monthly budgets for categories and bills, track actual spending vs budgeted amounts, visualize progress, and manage variable bill budgets with expected vs actual cost comparisons.

## Components to Create

### 1. **Budget Overview Dashboard** (`app/dashboard/budgets/page.tsx`)
**Features:**
- Monthly budget summary card showing total budgeted vs spent
- Category budget list with progress bars
- Variable bill budget tracking section
- Quick actions: Add budget, Edit budget, View history
- Month selector to view past/future budgets
- Budget vs actual comparison charts

### 2. **Budget Manager Component** (`components/budgets/budget-manager.tsx`)
**Features:**
- Set/edit monthly budget for each category
- Bulk budget setup (copy from previous month)
- Budget templates (50/30/20 rule, zero-based, etc.)
- Category grouping (essentials, discretionary, savings)
- Income-based budget calculator
- Rollover settings (unused budget carries over)

### 3. **Budget Progress Widget** (`components/budgets/budget-progress-widget.tsx`)
**Features:**
- Real-time spending progress
- Color-coded status:
  - Green: Under 80% of budget
  - Amber: 80-100% of budget
  - Red: Over budget
- Days remaining in month
- Daily spending average vs budget
- Projected month-end total

### 4. **Variable Bill Budget Tracker** (`components/budgets/variable-bill-tracker.tsx`)
**Features:**
- List of variable bills with budgeted amounts
- Actual vs expected comparison
- Historical average calculation
- Savings/overage highlighting
- Month-over-month trends
- Annual summary view

### 5. **Budget Analytics** (`components/budgets/budget-analytics.tsx`)
**Features:**
- Month-over-month comparison
- Category spending trends (6-month view)
- Budget adherence score
- Overspending categories ranking
- Savings rate calculation
- Income vs expenses ratio

### 6. **API Endpoints**

#### `/api/budgets/overview` (GET)
- Returns current month budget summary
- Total income budget vs actual
- Total expense budget vs actual
- Savings rate
- Category-by-category breakdown

#### `/api/budgets/category` (GET/POST/PUT)
- GET: Fetch all category budgets for a month
- POST: Create new category budget
- PUT: Update existing category budget
- Supports date range queries

#### `/api/budgets/bills/variable` (GET)
- Returns variable bill budget tracking
- Expected vs actual for each bill
- Historical averages
- Savings/overage totals

#### `/api/budgets/analyze` (GET)
- Budget adherence metrics
- Trend analysis
- Recommendations
- Budget vs actual for specified period

## Data Structure

### Existing Schema (Already in place)

#### budget_categories Table
- `id`: Primary key
- `userId`: User reference
- `name`: Category name
- `type`: 'income' | 'variable_expense' | 'monthly_bill' | 'savings' | 'debt' | 'non_monthly_bill'
- `monthlyBudget`: **Budget amount** ✓ Already exists
- `dueDate`: Day of month (for bills)
- `isActive`: Active status
- `isTaxDeductible`: Tax flag
- `sortOrder`: Display order
- `usageCount`: Usage tracking
- `lastUsedAt`: Last used timestamp
- `createdAt`: Creation timestamp

#### bills Table
- `id`: Primary key
- `name`: Bill name
- `expectedAmount`: **Budgeted/expected amount** ✓ Already exists
- `isVariableAmount`: **Flags if bill varies** ✓ Already exists
- `frequency`: 'monthly' | 'quarterly' | 'semi-annual' | 'annual'
- Other fields...

#### billInstances Table
- `id`: Primary key
- `billId`: Reference to bill
- `expectedAmount`: Expected cost
- `actualAmount`: **Actual cost when paid** ✓ Already exists
- `dueDate`: When due
- `paidDate`: When paid
- `status`: 'pending' | 'paid' | 'overdue'

### New Schema Additions Needed

#### monthly_budgets Table (Optional - for historical tracking)
```sql
CREATE TABLE monthly_budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL, -- 'YYYY-MM'
  category_id TEXT NOT NULL,
  budgeted_amount REAL NOT NULL,
  actual_amount REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES budget_categories(id)
);
```

*Note: This is optional. We can calculate actual spending from transactions table on the fly using existing `categoryId` and `date` fields.*

## UI Layout

### Budget Overview Page
```
┌────────────────────────────────────────────────┐
│  Budgets - May 2025                [◀ May ▶]  │
├────────────────────────────────────────────────┤
│  📊 Monthly Summary                            │
│  Income:   $5,000 budgeted | $4,850 actual    │
│  Expenses: $4,200 budgeted | $3,950 actual    │
│  Savings:  $800 (16% of income)               │
│  Status: Under budget by $250                  │
├────────────────────────────────────────────────┤
│  💰 Category Budgets                           │
│  ┌──────────────────────────────────────────┐ │
│  │ Groceries          $600/$700  [██████░░] │ │
│  │ 86% • $100 remaining • 5 days left       │ │
│  ├──────────────────────────────────────────┤ │
│  │ Utilities          $180/$200  [█████░░░] │ │
│  │ 90% • $20 remaining                      │ │
│  ├──────────────────────────────────────────┤ │
│  │ Gas                $145/$150  [█████░░░] │ │
│  │ 97% • $5 remaining • ⚠️ Near limit        │ │
│  └──────────────────────────────────────────┘ │
├────────────────────────────────────────────────┤
│  📝 Variable Bills                             │
│  ┌──────────────────────────────────────────┐ │
│  │ Electric   $120 budgeted | $105 actual   │ │
│  │ ✓ Saved $15 (12%)        │ 3-mo avg: $110│ │
│  ├──────────────────────────────────────────┤ │
│  │ Water      $80 budgeted  | $92 actual    │ │
│  │ ⚠️ Over $12 (15%)         │ 3-mo avg: $85 │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Budget Manager (Edit View)
```
┌────────────────────────────────────────────────┐
│  Set Monthly Budgets                           │
│  [Copy from last month] [Use template ▼]      │
├────────────────────────────────────────────────┤
│  Income                                        │
│  Salary              [$5,000]                  │
│  Side Income         [$0]                      │
├────────────────────────────────────────────────┤
│  Fixed Expenses                                │
│  Rent                [$1,500]  [Bill linked ✓]│
│  Car Payment         [$350]    [Bill linked ✓]│
├────────────────────────────────────────────────┤
│  Variable Expenses                             │
│  Groceries           [$700]                    │
│  Gas                 [$150]                    │
│  Entertainment       [$200]                    │
├────────────────────────────────────────────────┤
│  Savings                                       │
│  Emergency Fund      [$500]                    │
│  Vacation            [$300]                    │
├────────────────────────────────────────────────┤
│  Total Income:   $5,000                        │
│  Total Expenses: $4,200                        │
│  Savings:        $800                          │
│  [Cancel]  [Save Budget]                       │
└────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Budget Setup & Management
1. Create budget manager UI component
2. Build API endpoints for budget CRUD operations
3. Add budget templates (50/30/20, zero-based, etc.)
4. Implement bulk budget setup (copy previous month)
5. Add budget validation (income vs expenses)

### Phase 2: Real-Time Tracking
1. Enhance existing `/api/budgets/check` endpoint
2. Create budget overview dashboard page
3. Build budget progress widgets
4. Add real-time spending calculations
5. Implement color-coded status indicators
6. Add projections (daily rate, month-end forecast)

### Phase 3: Variable Bill Tracking
1. Create variable bill tracker component
2. Build `/api/budgets/bills/variable` endpoint
3. Calculate historical averages (3-month, 6-month)
4. Show savings/overage highlighting
5. Add bill budget vs actual comparison chart

### Phase 4: Analytics & Insights
1. Create budget analytics component
2. Build `/api/budgets/analyze` endpoint
3. Month-over-month comparison charts
4. Category trend analysis
5. Budget adherence scoring
6. Spending pattern insights

### Phase 5: Integration & Polish
1. Add budget warnings to transaction form (already exists)
2. Dashboard budget summary widget
3. Monthly budget review notifications
4. Budget vs actual reports
5. Export budget data (CSV/PDF)

## Calculation Logic

### Budget vs Actual for Categories
```typescript
// For a given month and category
const monthStart = '2025-05-01';
const monthEnd = '2025-05-31';

// Get budgeted amount from budget_categories
const budgeted = category.monthlyBudget;

// Calculate actual spending from transactions
const actual = SUM(
  SELECT amount FROM transactions
  WHERE categoryId = category.id
  AND type = 'expense'
  AND date >= monthStart
  AND date <= monthEnd
);

const remaining = budgeted - actual;
const percentage = (actual / budgeted) * 100;
const status = percentage >= 100 ? 'exceeded'
             : percentage >= 80 ? 'warning'
             : 'on_track';
```

### Variable Bill Budget Tracking
```typescript
// For a variable bill
const bill = await getBill(billId);
const expectedAmount = bill.expectedAmount; // Budgeted

// Get instances for time period
const instances = await getBillInstances({
  billId,
  startDate: '2025-01-01',
  endDate: '2025-12-31'
});

// Calculate actuals
const paidInstances = instances.filter(i => i.status === 'paid');
const totalActual = paidInstances.reduce((sum, i) => sum + i.actualAmount, 0);
const averageActual = totalActual / paidInstances.length;

// Comparison
const currentMonth = instances.find(i => i.month === '2025-05');
const variance = currentMonth.actualAmount - expectedAmount;
const variancePercent = (variance / expectedAmount) * 100;
const trend = averageActual > expectedAmount ? 'over_budget' : 'under_budget';
```

### Budget Adherence Score
```typescript
// Overall budget performance score (0-100)
const categories = await getAllCategoriesWithBudgets();

let totalScore = 0;
for (const category of categories) {
  const { budgeted, actual } = await getCategoryBudgetStatus(category.id);

  if (actual <= budgeted) {
    // Under or on budget = 100 points
    totalScore += 100;
  } else {
    // Over budget = penalize based on overage
    const overage = ((actual - budgeted) / budgeted) * 100;
    const score = Math.max(0, 100 - overage);
    totalScore += score;
  }
}

const adherenceScore = totalScore / categories.length;
// 90-100: Excellent
// 70-89: Good
// 50-69: Fair
// 0-49: Needs improvement
```

## Key Features

### 1. Real-Time Budget Tracking
- Live updates as transactions are entered
- Instant recalculation of remaining budget
- Visual progress bars and indicators

### 2. Smart Alerts
- Warning when 80% of budget is spent
- Alert when budget is exceeded
- Notification of unusual spending patterns
- Bill variance alerts (actual vs expected)

### 3. Historical Analysis
- Month-over-month comparisons
- Trend visualization (6-month charts)
- Average spending by category
- Budget vs actual history

### 4. Flexible Budget Models
- Zero-based budgeting (every dollar assigned)
- 50/30/20 rule (needs/wants/savings)
- Envelope method (category limits)
- Custom templates

### 5. Variable Bill Intelligence
- Automatic average calculation
- Seasonal adjustment suggestions
- Overage/savings tracking
- Budget recommendation based on history

## Integration Points

### With Existing Features

#### Transactions
- Budget warning on transaction entry (already exists)
- Auto-categorization affects budget tracking
- Split transactions split budget impact

#### Bills
- Link bill expected amount to budget
- Track variable bill performance
- Auto-update budget based on bill changes

#### Categories
- Category budget is core to system
- Category type affects budget grouping
- Usage tracking influences budgeting

#### Dashboard
- Budget summary widget
- Quick budget status
- Month-end projections

#### Reports
- Budget vs actual reports
- Variance analysis
- Spending by category with budget comparison

## Future Enhancements

### Phase 2+ Features
- **Budget Goals**: Set savings targets, track progress
- **Budget Challenges**: Gamification (no-spend days, under-budget streaks)
- **Smart Recommendations**: AI-suggested budget adjustments
- **Budget Sharing**: Household budget collaboration
- **Budget Rollover**: Unused budget carries to next month
- **Bi-weekly Budgets**: For bi-weekly income
- **Budget Forecasting**: Predict future spending
- **Budget Scenarios**: What-if analysis
- **Automated Budget Adjustments**: Based on income changes
- **Budget vs Income Ratio**: Track lifestyle inflation
- **Seasonal Budgets**: Different budgets by season
- **Budget Alerts via SMS/Email**: Real-time notifications
- **Budget API Webhooks**: Integrate with other tools

## Success Metrics
- Budget adherence rate (% of categories on budget)
- Average variance (budget vs actual)
- Savings rate improvement
- Budget setup completion rate
- User engagement with budget features
- Reduction in overspending incidents

## Design Principles
1. **Simplicity First**: Easy to set up and understand
2. **Real-Time Feedback**: Instant updates and alerts
3. **Visual Clarity**: Clear progress indicators
4. **Actionable Insights**: Show what to do, not just what happened
5. **Flexible**: Support multiple budgeting methods
6. **Mobile-Friendly**: Full functionality on all devices
