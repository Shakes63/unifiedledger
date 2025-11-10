# Variable Bill Tracking Implementation Plan

**Feature:** Phase 3 - Variable Bill Tracking
**Created:** 2025-11-09
**Status:** Planning Complete - Ready for Implementation

## Overview
Implement comprehensive tracking for variable bills (utilities, services with fluctuating costs) to help users budget accurately by comparing expected vs actual costs, identifying trends, and making data-driven budget adjustments.

## What are Variable Bills?
- Bills with `isVariableAmount: true` in the database
- Have an `expectedAmount` (budgeted/estimated cost)
- Have `actualAmount` when paid (recorded in billInstances)
- Examples: electricity, water, gas, internet (variable usage), phone (variable data)

## Feature Goals
1. ✅ Show all variable bills with expected vs actual comparison
2. ✅ Calculate and display historical averages (3-month, 6-month, 12-month)
3. ✅ Highlight savings (under budget) and overages (over budget)
4. ✅ Visualize month-over-month trends
5. ✅ Provide annual summary and insights
6. ✅ Allow inline editing of expected amounts
7. ✅ Suggest budget adjustments based on historical data

---

## Implementation Tasks

### Task 1: Create Variable Bill API Endpoint
**File:** `app/api/budgets/bills/variable/route.ts`

**Endpoint:** `GET /api/budgets/bills/variable`

**Query Parameters:**
- `month` (optional): YYYY-MM format, defaults to current month
- `billId` (optional): Filter to specific bill
- `view` (optional): 'month' | 'quarter' | 'year', defaults to 'month'

**Response Structure:**
```typescript
{
  summary: {
    totalExpected: number,      // Sum of all expected amounts
    totalActual: number,         // Sum of all actual amounts paid
    totalVariance: number,       // Difference (negative = savings, positive = overage)
    variancePercent: number,     // Percentage variance
    billCount: number,           // Number of variable bills
    paidCount: number,           // Number paid this period
    pendingCount: number         // Number pending payment
  },
  bills: [
    {
      id: string,
      name: string,
      frequency: string,
      expectedAmount: number,
      currentMonth: {
        month: string,             // YYYY-MM
        instanceId: string | null,
        expectedAmount: number,
        actualAmount: number | null,
        variance: number | null,   // null if not paid yet
        variancePercent: number | null,
        status: 'pending' | 'paid' | 'overdue',
        dueDate: string,
        paidDate: string | null
      },
      historicalAverages: {
        threeMonth: number,        // Average of last 3 paid instances
        sixMonth: number,          // Average of last 6 paid instances
        twelveMonth: number,       // Average of last 12 paid instances
        allTime: number            // Overall average
      },
      monthlyBreakdown: [          // Last 12 months
        {
          month: string,           // YYYY-MM
          expected: number,
          actual: number | null,
          variance: number | null,
          status: 'pending' | 'paid' | 'overdue'
        }
      ],
      trend: {
        direction: 'improving' | 'worsening' | 'stable',  // Based on recent trend
        percentChange: number,     // Month-over-month change
        recommendedBudget: number  // Suggested expected amount based on history
      }
    }
  ]
}
```

**Implementation Details:**
1. Verify user authentication (Clerk)
2. Get user's household ID
3. Query bills table for `isVariableAmount = true`
4. For each bill:
   - Get current month's bill instance
   - Query last 12 months of bill instances (paid only for averages)
   - Calculate historical averages using Decimal.js
   - Calculate variance (actual - expected)
   - Determine trend direction (compare last 3 months to previous 3 months)
   - Suggest recommended budget (use 6-month average + 10% buffer)
5. Calculate summary totals
6. Return comprehensive response

**Calculations:**
```typescript
// Use Decimal.js for all money calculations
import Decimal from 'decimal.js';

// Variance
const variance = new Decimal(actualAmount).minus(expectedAmount);
const variancePercent = variance.div(expectedAmount).times(100);

// 3-month average
const recentInstances = last3PaidInstances;
const sum = recentInstances.reduce((acc, i) =>
  acc.plus(new Decimal(i.actualAmount)), new Decimal(0)
);
const threeMonthAvg = sum.div(recentInstances.length);

// Trend direction
const recent3Avg = calculateAverage(months[0-2]);
const previous3Avg = calculateAverage(months[3-5]);
const trend = recent3Avg.lt(previous3Avg) ? 'improving'
            : recent3Avg.gt(previous3Avg) ? 'worsening'
            : 'stable';

// Recommended budget (6-month average + 10% buffer)
const sixMonthAvg = calculateAverage(last6Months);
const recommendedBudget = sixMonthAvg.times(1.1).toDecimalPlaces(2);
```

**Error Handling:**
- Return 401 if not authenticated
- Return 404 if no variable bills found (with empty array)
- Handle missing bill instances gracefully
- Default to 0 or null for missing data points

---

### Task 2: Create VariableBillCard Component
**File:** `components/budgets/variable-bill-card.tsx`

**Purpose:** Display individual variable bill with all tracking data

**Props:**
```typescript
interface VariableBillCardProps {
  bill: {
    id: string;
    name: string;
    frequency: string;
    expectedAmount: number;
    currentMonth: { ... };
    historicalAverages: { ... };
    trend: { ... };
  };
  onUpdateExpectedAmount?: (billId: string, newAmount: number) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Electric Bill                        [Edit ▼]   │
│ Expected: $120  |  Actual: $105  |  ✓ Saved $15│
│ ████████████████░░░░ 87.5% (12.5% under budget)│
│                                                  │
│ 📊 Averages:                                    │
│ 3-month: $110  |  6-month: $115  |  12-mo: $118│
│                                                  │
│ 💡 Insight: Trending down! Consider reducing    │
│    budget to $115 (6-month avg + 10%)           │
│                                                  │
│ [View History] [Adjust Budget]                  │
└─────────────────────────────────────────────────┘
```

**Features:**
1. **Header Section**
   - Bill name with frequency badge
   - Edit button (dropdown menu)
   - Expand/collapse toggle

2. **Current Month Status**
   - Expected amount (editable inline)
   - Actual amount (from paid instance, or "Pending" if not paid)
   - Variance display:
     - Green text + ✓ icon for savings (under budget)
     - Amber text + ⚠️ icon for minor overage (5-15% over)
     - Red text + ❌ icon for significant overage (>15% over)
   - Progress bar (color-coded based on variance)

3. **Historical Averages Section**
   - 3-month, 6-month, 12-month averages
   - Badges with tooltips explaining calculation
   - All-time average

4. **Trend & Insights**
   - Trend indicator (↗️ worsening, ↘️ improving, → stable)
   - Recommendation message
   - Quick action button to apply recommended budget

5. **Actions**
   - "View History" button → opens modal with monthly breakdown chart
   - "Adjust Budget" button → inline edit mode for expectedAmount

**Styling:**
- Use `bg-card` and `border-border` for card
- Use `text-foreground` and `text-muted-foreground` for text
- Use semantic color variables:
  - `text-[var(--color-success)]` for savings
  - `text-[var(--color-warning)]` for minor overages
  - `text-[var(--color-error)]` for significant overages
- Progress bar using existing budget progress pattern
- 12px border radius (`rounded-xl`)
- Hover state: `hover:bg-elevated`
- Smooth transitions for expand/collapse

**Interactivity:**
1. Click card header to expand/collapse details
2. Click "Edit" to enter inline edit mode for expected amount
3. Click "View History" to open modal with chart
4. Click "Adjust Budget" to apply recommended amount
5. All state changes use optimistic updates with toast notifications

---

### Task 3: Create VariableBillTracker Component
**File:** `components/budgets/variable-bill-tracker.tsx`

**Purpose:** Main container component for variable bill tracking section

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ 📝 Variable Bills - May 2025       [◀ May ▶]   │
├─────────────────────────────────────────────────┤
│ 📊 Summary                                       │
│ Total Expected:  $450                            │
│ Total Actual:    $420                            │
│ Total Savings:   $30 (6.7%)              ✓      │
│                                                  │
│ 5 bills tracked  |  4 paid  |  1 pending        │
├─────────────────────────────────────────────────┤
│ [All Bills ▼] [Expand All] [Collapse All]      │
├─────────────────────────────────────────────────┤
│ <VariableBillCard> Electric                     │
│ <VariableBillCard> Water                        │
│ <VariableBillCard> Gas                          │
│ <VariableBillCard> Internet                     │
│ <VariableBillCard> Phone                        │
├─────────────────────────────────────────────────┤
│ 💡 Overall Insight:                             │
│ You're doing great! 80% of bills came in under  │
│ budget this month. Consider reducing budgets    │
│ for consistently under-budget bills.            │
└─────────────────────────────────────────────────┘
```

**Features:**
1. **Header with Month Selector**
   - Title with current month
   - Previous/Next month navigation buttons
   - Quick jump to current month

2. **Summary Card**
   - Total expected amount
   - Total actual amount (only paid bills)
   - Total variance with percentage
   - Color-coded status indicator
   - Bill counts (total, paid, pending)

3. **Filter & Controls**
   - Filter dropdown: All Bills / Under Budget / Over Budget / Pending
   - Expand All button
   - Collapse All button

4. **Bill List**
   - All variable bills displayed as VariableBillCard components
   - Initially all collapsed for clean view
   - Empty state if no variable bills:
     ```
     No variable bills yet.
     Variable bills help you track costs that change month-to-month.
     [Set up your first variable bill →]
     ```

5. **Overall Insights**
   - Performance summary message
   - Actionable recommendations
   - Links to related features (budget templates, bill setup)

**State Management:**
- Month selection state
- Expanded/collapsed state per bill (localStorage persistence)
- Filter selection state
- Loading state for API calls
- Error state with retry option

**Data Fetching:**
- Fetch on mount and when month changes
- Use React Query or SWR for caching (if available)
- Optimistic updates when editing expected amounts
- Refresh after successful updates

**Responsive Design:**
- Desktop: Full width with 2-column summary
- Tablet: Single column, compact summary
- Mobile: Stacked layout, collapsible everything

---

### Task 4: Create VariableBillChart Component
**File:** `components/budgets/variable-bill-chart.tsx`

**Purpose:** Visualize expected vs actual trends over time

**Props:**
```typescript
interface VariableBillChartProps {
  billId: string;
  billName: string;
  monthlyData: Array<{
    month: string;
    expected: number;
    actual: number | null;
  }>;
  view?: '6month' | '12month';
}
```

**Chart Type:** Line chart with two lines (Expected, Actual)

**Features:**
1. **Dual Lines**
   - Expected amount line (dashed, using `--color-muted-foreground`)
   - Actual amount line (solid, using `--color-primary`)
   - Fill area between lines when actual < expected (success color)
   - Fill area between lines when actual > expected (error color)

2. **Interactive Tooltips**
   - Show month, expected, actual, variance on hover
   - Format as currency
   - Color-coded variance

3. **Legend**
   - Expected vs Actual legend items
   - Toggle visibility of each line

4. **View Toggle**
   - Switch between 6-month and 12-month views
   - Button group or segmented control

5. **Responsive**
   - Chart height scales with container
   - Font sizes adjust for mobile
   - Touch-friendly tooltips on mobile

**Implementation:**
- Use Recharts library (already in project)
- Components: LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area
- Theme integration:
  - Grid color: `var(--color-border)`
  - Text color: `var(--color-muted-foreground)`
  - Line colors from theme variables
- Format currency using Intl.NumberFormat
- Handle null actual values (don't plot, show gap)

**Usage:**
- Used in modal when clicking "View History" on VariableBillCard
- Optional: Add to main tracker as overview chart showing all bills

---

### Task 5: Integrate into Budget Overview Dashboard
**File:** `app/dashboard/budgets/page.tsx`

**Changes:**
1. Import VariableBillTracker component
2. Add new section after Category Budgets section
3. Position in layout:
   ```tsx
   <BudgetSummaryCard />
   <CategoryBudgetProgress />
   <VariableBillTracker />  {/* NEW */}
   ```

4. Conditional rendering:
   - Only show if user has variable bills
   - Show empty state with setup prompt if no variable bills
   - Loading skeleton while fetching data

5. Section header:
   ```tsx
   <h2 className="text-xl font-semibold text-foreground">
     Variable Bills
   </h2>
   <p className="text-sm text-muted-foreground">
     Track bills with costs that change each month
   </p>
   ```

6. Collapsible section (optional):
   - Allow users to collapse the entire variable bills section
   - Save preference to localStorage
   - Expand/collapse toggle in header

---

### Task 6: Add Update Expected Amount Endpoint
**File:** `app/api/bills/[id]/route.ts`

**Method:** `PUT`

**Purpose:** Update the expectedAmount for a bill

**Request Body:**
```typescript
{
  expectedAmount: number  // Must be positive
}
```

**Response:**
```typescript
{
  id: string,
  name: string,
  expectedAmount: number,
  // ... other bill fields
}
```

**Validation:**
1. Verify user authentication
2. Verify bill belongs to user's household
3. Validate expectedAmount:
   - Must be a number
   - Must be > 0
   - Must be reasonable (< $100,000)
4. Use Decimal.js for precision

**Implementation:**
```typescript
// Verify bill ownership
const bill = await db.query.bills.findFirst({
  where: and(
    eq(bills.id, billId),
    eq(bills.householdId, user.householdId)
  )
});

if (!bill) {
  return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
}

// Validate amount
const amount = new Decimal(expectedAmount);
if (amount.lte(0) || amount.gt(100000)) {
  return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
}

// Update
await db.update(bills)
  .set({ expectedAmount: amount.toNumber() })
  .where(eq(bills.id, billId));
```

**Client-side Usage:**
- Called from VariableBillCard when user updates expected amount
- Optimistic update (update UI immediately, revert on error)
- Show success toast on successful update
- Refresh variable bill data after update

---

### Task 7: Add Trend Indicators and Insights

**Purpose:** Provide intelligent insights and recommendations

**Trend Calculation:**
```typescript
// Compare recent 3 months vs previous 3 months
const recent3 = instances.slice(0, 3).filter(i => i.status === 'paid');
const previous3 = instances.slice(3, 6).filter(i => i.status === 'paid');

const recentAvg = calculateAverage(recent3);
const previousAvg = calculateAverage(previous3);

const percentChange = recentAvg.minus(previousAvg)
  .div(previousAvg)
  .times(100);

const direction = percentChange.lt(-5) ? 'improving'
                : percentChange.gt(5) ? 'worsening'
                : 'stable';
```

**Insight Messages:**

1. **Improving Trend (costs decreasing):**
   ```
   "Trending down! Your [bill name] has decreased by [X]% over the last 3 months.
   Consider reducing your budget to $[recommended] to better reflect actual usage."
   ```

2. **Worsening Trend (costs increasing):**
   ```
   "Costs are rising. Your [bill name] has increased by [X]% over the last 3 months.
   Consider increasing your budget to $[recommended] to avoid overspending alerts."
   ```

3. **Stable Trend:**
   ```
   "Stable spending. Your [bill name] has remained consistent.
   Your current budget of $[expected] appears accurate."
   ```

4. **Consistently Under Budget:**
   ```
   "You've been under budget for 3+ consecutive months!
   Reduce your budget to $[recommended] to free up funds for other categories."
   ```

5. **Consistently Over Budget:**
   ```
   "Over budget for 3+ months. Consider increasing your budget to $[recommended]
   or explore ways to reduce usage."
   ```

**Recommendation Logic:**
```typescript
// Use 6-month average + buffer
const sixMonthAvg = calculateAverage(last6PaidInstances);
const buffer = trend.direction === 'worsening' ? 1.15 : 1.10;
const recommended = sixMonthAvg.times(buffer).toDecimalPlaces(2);
```

**Display Locations:**
1. Individual bill cards (specific to that bill)
2. Overall insights section (aggregate recommendations)
3. Notification system (alert for significant changes)

---

### Task 8: Testing and Polish

**Testing Checklist:**

1. **API Endpoint Testing**
   - [ ] Returns correct data for user with variable bills
   - [ ] Returns empty array for user with no variable bills
   - [ ] Handles missing bill instances gracefully
   - [ ] Calculates averages correctly (verify with Decimal.js)
   - [ ] Trend direction calculation is accurate
   - [ ] Month parameter works correctly
   - [ ] Authorization works (user can't access other's bills)
   - [ ] Performance with large datasets (100+ instances)

2. **Component Testing**
   - [ ] VariableBillCard displays all data correctly
   - [ ] Color coding works (green/amber/red)
   - [ ] Expand/collapse animation smooth
   - [ ] Inline edit for expected amount works
   - [ ] Progress bar fills correctly
   - [ ] Empty states display properly
   - [ ] Loading states work
   - [ ] Error states show with retry option

3. **Integration Testing**
   - [ ] Updates to expected amount refresh data
   - [ ] Month navigation updates all bills
   - [ ] Filter controls work correctly
   - [ ] Expand/collapse all works
   - [ ] localStorage persistence works
   - [ ] Budget dashboard integration seamless

4. **Responsive Design Testing**
   - [ ] Desktop (1920x1080): Full layout
   - [ ] Laptop (1366x768): Compact layout
   - [ ] Tablet (768x1024): Single column
   - [ ] Mobile (375x667): Stacked, collapsible
   - [ ] Touch interactions work on mobile
   - [ ] Charts scale properly
   - [ ] No horizontal scroll

5. **Theme Testing**
   - [ ] Dark Mode theme looks correct
   - [ ] Dark Pink theme looks correct
   - [ ] All colors use CSS variables
   - [ ] No hardcoded hex colors
   - [ ] Hover states work in both themes
   - [ ] Charts use theme colors
   - [ ] Contrast ratios meet accessibility standards

6. **Data Accuracy Testing**
   - [ ] Decimal.js used for all calculations
   - [ ] No floating-point errors
   - [ ] Currency formatting correct
   - [ ] Percentage calculations accurate
   - [ ] Date handling correct across timezones
   - [ ] Null/undefined handling safe

7. **Edge Cases**
   - [ ] Bill with no paid instances (all pending)
   - [ ] Bill with only 1-2 instances (not enough for averages)
   - [ ] Bill paid multiple times in one month
   - [ ] Bill with $0 actual amount
   - [ ] Bill with very large amounts ($10,000+)
   - [ ] Bill with very small amounts ($0.01)
   - [ ] Quarterly/annual bills (non-monthly frequency)

8. **Performance Testing**
   - [ ] Initial load time < 1 second
   - [ ] Month navigation instant
   - [ ] Chart rendering smooth
   - [ ] No memory leaks
   - [ ] Efficient re-renders (React.memo where appropriate)

9. **Accessibility Testing**
   - [ ] Keyboard navigation works
   - [ ] Screen reader friendly
   - [ ] Focus indicators visible
   - [ ] ARIA labels present
   - [ ] Color not only indicator (icons + text)
   - [ ] Touch targets ≥ 44px

10. **Build Testing**
    - [ ] TypeScript compiles without errors
    - [ ] No console errors/warnings
    - [ ] Production build successful
    - [ ] Bundle size reasonable (no huge dependencies)

**Polish Items:**

1. **Animations**
   - Add smooth transitions for all state changes
   - Card expand/collapse: 300ms ease-in-out
   - Progress bar fill: 500ms ease-out
   - Hover states: 150ms ease-in-out

2. **Loading States**
   - Skeleton loaders for cards while fetching
   - Shimmer effect for better UX
   - Spinner for inline actions

3. **Empty States**
   - Helpful message explaining variable bills
   - Clear call-to-action to create first variable bill
   - Illustration or icon
   - Link to bills setup page

4. **Error Handling**
   - Network errors: Show retry button
   - Invalid data: Show helpful error message
   - Failed updates: Revert optimistic update, show toast
   - Graceful degradation (show what data we have)

5. **Micro-interactions**
   - Success toast when updating expected amount
   - Confetti or celebration when all bills under budget
   - Gentle shake animation for over-budget warnings
   - Pulse animation for new insights

6. **Documentation**
   - Add JSDoc comments to all functions
   - Document props with TypeScript
   - Add inline code comments for complex logic
   - Update README if needed

---

## UI/UX Considerations

### Color Coding Rules
- **Under Budget (Savings):**
  - 0-10% under: Light green background, success text
  - 10%+ under: Bright green background, bold success text

- **On Budget:**
  - Within ±5%: Neutral/accent color, no special indicator

- **Over Budget (Overage):**
  - 5-15% over: Amber background, warning text
  - 15%+ over: Red background, error text

### Typography
- Bill names: font-semibold, text-foreground
- Amounts: JetBrains Mono font, text-lg
- Percentages: text-sm, colored based on variance
- Helper text: text-xs, text-muted-foreground

### Spacing
- Card padding: p-6
- Section spacing: space-y-4
- Element spacing: gap-2 or gap-3
- Consistent with existing budget components

### Icons
- ✓ Checkmark for savings (text-[var(--color-success)])
- ⚠️ Warning for minor overage (text-[var(--color-warning)])
- ❌ X for significant overage (text-[var(--color-error)])
- 📊 Chart for historical data
- 💡 Lightbulb for insights
- ↗️↘️→ for trend indicators

---

## Integration with Existing Features

### 1. Bills Page
- Add "Variable Bills" tab or section
- Quick link to variable bill tracker
- Badge showing count of variable bills

### 2. Transaction Entry
- When paying a variable bill:
  - Show expected amount as reference
  - Show variance after amount entered
  - Highlight if significantly over/under budget

### 3. Notifications
- Alert when variable bill is >20% over budget
- Suggest budget adjustment when consistently under
- Monthly summary of variable bill performance

### 4. Reports
- Include variable bill variance in expense reports
- Add to budget vs actual reports
- Trend charts for utility costs over time

### 5. Dashboard Widgets
- Mini variable bill summary widget
- Show total variance this month
- Quick link to full tracker

---

## Data Flow

```
User Action: View variable bills
     ↓
API Call: GET /api/budgets/bills/variable
     ↓
Database Queries:
  - Get all bills where isVariableAmount = true
  - Get bill instances for date range
  - Calculate averages and trends
     ↓
Return structured data
     ↓
Components render with data
     ↓
User interacts (expand, edit, navigate month)
     ↓
State updates (local) or API calls (updates)
     ↓
Optimistic UI updates
     ↓
Background data refresh
```

---

## File Structure Summary

**New Files:**
```
app/api/budgets/bills/variable/route.ts        (API endpoint)
components/budgets/variable-bill-tracker.tsx   (Main component)
components/budgets/variable-bill-card.tsx      (Individual bill)
components/budgets/variable-bill-chart.tsx     (Visualization)
```

**Modified Files:**
```
app/dashboard/budgets/page.tsx                 (Add variable bill section)
app/api/bills/[id]/route.ts                    (Add PUT for expected amount)
```

**Total:** 4 new files, 2 modified files

---

## Success Criteria

✅ **Feature Complete When:**
1. Users can view all their variable bills in one place
2. Current month expected vs actual is clearly displayed
3. Historical averages (3, 6, 12 months) are calculated and shown
4. Savings and overages are highlighted with color coding
5. Users can edit expected amounts inline
6. Trend indicators show if costs are improving/worsening
7. Intelligent insights and recommendations are provided
8. Month-over-month chart visualizes trends
9. Fully integrated into budget overview dashboard
10. Responsive design works on all devices
11. Theme variables used throughout
12. All calculations use Decimal.js
13. Production build successful
14. No TypeScript errors
15. Comprehensive testing complete

---

## Timeline Estimate

- **Task 1** (API Endpoint): 2-3 hours
- **Task 2** (VariableBillCard): 2-3 hours
- **Task 3** (VariableBillTracker): 2-3 hours
- **Task 4** (VariableBillChart): 1-2 hours
- **Task 5** (Integration): 1 hour
- **Task 6** (Update Endpoint): 1 hour
- **Task 7** (Insights): 1-2 hours
- **Task 8** (Testing & Polish): 2-3 hours

**Total: 12-17 hours** (1.5-2 days of focused development)

---

## Next Steps After Completion

1. Monitor user feedback on variable bill tracking
2. Iterate on insights and recommendations
3. Consider adding:
   - Budget alerts via email/SMS
   - Seasonal adjustment suggestions
   - Bill payment reminders
   - Integration with smart home devices (future)
4. Move to Phase 4: Analytics & Insights
5. Document learnings and patterns for future features

---

## Notes

- All financial calculations MUST use Decimal.js
- All colors MUST use CSS variables from theme system
- All dates should handle timezones properly
- All API endpoints require authentication
- Optimistic updates for better UX
- Toast notifications for all user actions
- Accessibility is non-negotiable
- Mobile-first design approach
- Performance matters (aim for <1s load times)

---

**Status:** ✅ Plan Complete - Ready to Begin Implementation

**Next Action:** Start Task 1 - Create Variable Bill API Endpoint
