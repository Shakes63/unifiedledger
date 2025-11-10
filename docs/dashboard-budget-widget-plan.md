# Dashboard Budget Summary Widget Implementation Plan

**Feature:** Dashboard Budget Summary Widget (Phase 2 completion)
**Date:** 2025-11-09
**Status:** Ready to implement

## Overview

Create a compact budget summary widget for the main dashboard that provides at-a-glance budget status and quick access to the full budgets page.

## Requirements

### Display Elements

1. **Budget Adherence Score**
   - 0-100 score with color-coded ring/badge
   - Quality label (Excellent/Good/Fair/Poor)
   - Visual progress indicator

2. **Category Status Counts**
   - Categories on track (green)
   - Categories at warning (amber)
   - Categories over budget (red)
   - Unbudgeted categories

3. **Quick Stats**
   - Total budgeted amount
   - Total spent this month
   - Overall percentage

4. **Quick Action**
   - Link to full budgets page
   - "View Details" or "Manage Budgets" button

### Design Specifications

**Layout:**
```
┌─────────────────────────────────────┐
│ Budget Status          [View All →] │
├─────────────────────────────────────┤
│         ┌─────┐                     │
│         │ 85% │  Good               │
│         └─────┘                     │
│     Budget Adherence                │
├─────────────────────────────────────┤
│ This Month                          │
│ $3,950 / $4,200 (94%)               │
│ [████████████░░] 94%                │
├─────────────────────────────────────┤
│ ● 8 On Track  ● 2 Warning  ● 1 Over│
└─────────────────────────────────────┘
```

**Theme Integration:**
- `bg-card` - Card background
- `border-border` - Card border
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `bg-[var(--color-success)]` - On-track indicator
- `bg-[var(--color-warning)]` - Warning indicator
- `bg-[var(--color-error)]` - Over-budget indicator
- `bg-[var(--color-primary)]` - Primary action button
- Progress ring colors based on adherence score

**Responsive:**
- Same size as other dashboard cards
- Stacks content vertically on mobile
- Fits in dashboard grid

## Implementation Tasks

### Task 1: Create Budget Summary Widget Component

**File:** `components/dashboard/budget-summary-widget.tsx`

**Props:**
```typescript
interface BudgetSummaryWidgetProps {
  // No props - fetches its own data
}
```

**State:**
```typescript
{
  loading: boolean;
  error: string | null;
  summary: {
    adherenceScore: number;
    totalBudget: number;
    totalSpent: number;
    percentage: number;
    onTrack: number;
    warning: number;
    exceeded: number;
    unbudgeted: number;
  } | null;
}
```

**Data Fetching:**
- Use existing `/api/budgets/overview` endpoint
- Fetch on component mount
- Show loading skeleton
- Handle errors gracefully
- Conditional rendering (only show if budgets exist)

**Features:**
- Circular progress indicator for adherence score
- Color-coded category status badges
- Overall progress bar
- Click card to navigate to `/dashboard/budgets`
- Hover effect on card

### Task 2: Integrate Widget into Dashboard

**File:** `app/dashboard/page.tsx`

**Changes:**
- Import BudgetSummaryWidget component
- Add to dashboard grid (between existing widgets)
- Position after BudgetSurplusCard (they're related)

**Layout Order:**
1. Monthly Spending Card
2. Total Balance + Accounts Card
3. Credit Utilization Widget (conditional)
4. **Budget Summary Widget** ← NEW
5. Budget Surplus Card
6. Debt Countdown Card
7. Bills Widget
8. Recent Transactions

### Task 3: Create Loading Skeleton

**Implementation:**
- Skeleton with shimmer effect
- Matches widget dimensions
- Shows placeholder circles and bars
- Uses theme colors

### Task 4: Add Empty State

**Condition:** No budgets set for current month

**Display:**
- Friendly message: "No budgets set"
- Description: "Set budgets to track your spending"
- Button: "Get Started" → links to `/dashboard/budgets`

### Task 5: Testing & Polish

**Test Cases:**
- Widget loads correctly
- Data displays accurately
- Colors match budget status
- Links navigate correctly
- Responsive on all screen sizes
- Loading state works
- Empty state displays when needed
- Widget hides if no budget data
- Theme switching works

## Data Flow

```typescript
// Component mount
useEffect(() => {
  fetchBudgetSummary();
}, []);

// Fetch from API
const fetchBudgetSummary = async () => {
  const response = await fetch('/api/budgets/overview');
  const data = await response.json();

  // Calculate summary stats
  const summary = {
    adherenceScore: data.summary.adherenceScore,
    totalBudget: data.summary.totalExpenseBudget,
    totalSpent: data.summary.totalExpenseActual,
    percentage: (totalSpent / totalBudget) * 100,
    onTrack: data.categories.filter(c => c.status === 'on_track').length,
    warning: data.categories.filter(c => c.status === 'warning').length,
    exceeded: data.categories.filter(c => c.status === 'exceeded').length,
    unbudgeted: data.categories.filter(c => c.status === 'unbudgeted').length,
  };

  setSummary(summary);
};
```

## Visual Design

### Adherence Score Ring

**Score Ranges:**
- 90-100: Green ring, "Excellent"
- 70-89: Green/teal ring, "Good"
- 50-69: Amber ring, "Fair"
- 0-49: Red ring, "Needs Improvement"

**Implementation:**
- SVG circle with stroke-dasharray
- Animated on load
- Large percentage in center
- Label below

### Progress Bar

**Style:**
- Height: 8px
- Rounded corners (full)
- Background: `bg-muted`
- Fill color based on percentage:
  - 0-79%: `bg-[var(--color-success)]`
  - 80-99%: `bg-[var(--color-warning)]`
  - 100%+: `bg-[var(--color-error)]`
- Smooth transition on data change

### Category Status Badges

**Layout:**
- Horizontal row
- Small colored dots
- Count next to each dot
- Wrap on small screens

**Colors:**
- On Track: `text-[var(--color-success)]`
- Warning: `text-[var(--color-warning)]`
- Over Budget: `text-[var(--color-error)]`
- Unbudgeted: `text-muted-foreground`

## Success Criteria

✅ Widget displays current month's budget summary
✅ Adherence score shown with color-coded ring
✅ Category status counts accurate
✅ Overall progress bar reflects spending
✅ Click widget navigates to budgets page
✅ Loading state shows skeleton
✅ Empty state shows when no budgets
✅ Widget conditionally renders (hides if no data)
✅ Responsive on all devices
✅ Theme switching works correctly
✅ Uses Decimal.js for calculations
✅ Matches dashboard card style

## File Checklist

- [ ] Create `components/dashboard/budget-summary-widget.tsx`
- [ ] Update `app/dashboard/page.tsx` to include widget
- [ ] Test on dashboard
- [ ] Verify responsiveness
- [ ] Test theme switching
- [ ] Test empty state
- [ ] Build verification

## Estimated Time

- Component creation: 30 minutes
- Integration: 10 minutes
- Testing & polish: 20 minutes
- **Total: ~1 hour**

---

**Implementation Date:** 2025-11-09
**Completes:** Phase 2 - Real-Time Tracking
