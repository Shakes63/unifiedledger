# Debt Reduction Chart - Implementation Plan

## Feature Overview

**Goal**: Track debt progress over time with interactive visualizations showing:
- Line chart of total debt declining toward zero
- Comparison of actual vs projected trajectory
- Individual debt balance tracking (stacked line chart)
- Celebration milestone when debts reach zero
- Real-time accuracy based on actual payment history

**User Value**: Provides visual motivation and accountability - users see their progress toward debt freedom, not just numerical countdown. Highlights if they're ahead/behind schedule.

## Architecture & Data Model

### Data Sources
1. **Current Debts**: Active debts with remaining balance (from `/api/debts`)
2. **Payment History**: Historical payments for each debt (from `debt_payments` table)
3. **Payoff Projection**: Calculated debt-free date and monthly projections (from payoff calculator)
4. **Actual Balance History**: Monthly balance snapshots (need to calculate from payment history)

### New Database Considerations
- **No new tables needed** - leverage existing `debt_payments`, `debts`, and `transactions` tables
- Calculate historical balances from payment records
- Cache calculations if needed for performance (optional future optimization)

### API Endpoints

**GET `/api/debts/reduction-chart`**
```typescript
{
  chartData: [
    {
      month: "2024-11",
      projectedTotal: 15000,
      actualTotal: 14800,
      byDebt: {
        "debt-id-1": 5000,
        "debt-id-2": 9800
      }
    },
    ...
  ],
  projectionStartDate: "2024-11-09",
  debtDetails: [
    {
      id: "debt-id-1",
      name: "Credit Card",
      originalBalance: 10000,
      currentBalance: 5000,
      payoffDate: "2025-06",
      color: "var(--color-income)" // turquoise for chart
    },
    ...
  ],
  summary: {
    totalOriginalDebt: 30000,
    totalCurrentDebt: 14800,
    totalPaid: 15200,
    percentageComplete: 50.67,
    debtFreeDate: "2026-03-15"
  }
}
```

## Component Structure

### 1. **DebtReductionChart** (Main Container)
- Location: `components/debts/debt-reduction-chart.tsx`
- Responsibilities:
  - Fetch chart data from API
  - Manage view toggle state (combined vs individual debts)
  - Handle loading and error states
  - Render sub-components

### 2. **TotalDebtChart** (Recharts Component)
- Location: `components/debts/total-debt-chart.tsx`
- Displays:
  - Line chart with two lines: Projected vs Actual
  - X-axis: Months
  - Y-axis: Total debt amount (formatted currency)
  - Legend: Projected vs Actual
  - Tooltip: Month, projected amount, actual amount, difference
  - Area fill under actual line (subtle gradient)
  - Celebration visual when final point hits zero

### 3. **IndividualDebtsChart** (Recharts Component)
- Location: `components/debts/individual-debts-chart.tsx`
- Displays:
  - Stacked area chart showing each debt's balance
  - Each debt as separate color from theme palette
  - X-axis: Months
  - Y-axis: Debt amount
  - Legend: Debt names (colored dots matching chart)
  - Tooltip: All debts at current month with individual amounts
  - Interactive: Click debt name to toggle visibility

### 4. **DebtReductionSummary** (Stats Card)
- Location: `components/debts/debt-reduction-summary.tsx`
- Displays:
  - Total paid to date (large number)
  - Percentage complete (progress ring or bar)
  - Months until debt-free
  - Estimated payoff date
  - Total original vs current debt comparison

### 5. **ViewToggle** (Toggle Component)
- Location: Within DebtReductionChart
- Allows switching between:
  - Combined total chart
  - Individual debts stacked chart
  - Both visible (side-by-side on desktop, stacked on mobile)

## UI/UX Integration

### Placement on Debts Page
- **Position**: Top section, above "What-If Scenario Calculator"
- **Container**: Full-width collapsible card with toggle
- **Default State**: Collapsed until user expands
- **Height**: 400px on desktop, 500px on mobile (account for legend)

### Design System Compliance

**Color Usage (Theme Variables)**:
- Chart backgrounds: `var(--color-card)` (card background)
- Chart borders: `var(--color-border)` (subtle dividers)
- Text: `var(--color-foreground)` (axis labels, legend)
- Axis lines: `var(--color-muted-foreground)` (subtle gridlines)
- Lines:
  - Projected: `var(--color-muted-foreground)` (dashed line, secondary)
  - Actual: `var(--color-income)` (solid line, primary - turquoise)
- Area fill: `color-mix(in oklch, var(--color-income) 20%, transparent)` (subtle)
- Individual debts: Use color palette from theme (primary, accent, success, warning, error)

**Typography**:
- Labels: `text-sm text-muted-foreground`
- Legend: `text-xs text-muted-foreground`
- Tooltip: `text-sm text-foreground`
- Title: `text-lg font-semibold text-foreground`

**Spacing**:
- Container padding: 24px (using Tailwind `p-6`)
- Chart height: 400px desktop, 500px mobile
- Legend gap: 12px below chart
- Summary section: 16px top margin, `gap-4` grid

**Responsiveness**:
- Desktop (1024px+): Side-by-side charts or full-width
- Tablet (768px-1023px): Stacked charts
- Mobile (< 768px): Single chart, summary below

### Interactive Features
1. **Hover Effects**:
   - Chart: Show vertical line at month, highlight point
   - Legend: Hover debt name to highlight that line/area
   - Summary: Subtle background color shift on hover

2. **Click Interactions**:
   - Legend item: Toggle debt visibility (if stacked chart)
   - Data point: Show detail modal similar to amortization schedule

3. **Animations**:
   - Chart data update: Smooth line animation (500ms)
   - Area fill: Fade in on load
   - Celebration: Confetti-like effect or color pulse at payoff point

## Implementation Steps

### Phase 1: Backend Setup (Steps 1-3)

**Step 1: Create `/api/debts/reduction-chart` Endpoint**
- Fetch all active debts for user
- Calculate historical balances from payment records:
  - For each month since debt creation or first payment
  - Sum remaining balances at that point in time
- Generate 12-month forward projection using payoff calculator
- Format response with both actual history and projected future
- Files:
  - `app/api/debts/reduction-chart/route.ts` (new)
  - May reuse `lib/debts/payoff-calculator.ts`

**Step 2: Add Calculation Utility**
- Create `lib/debts/reduction-chart-utils.ts`
- Export functions:
  - `calculateHistoricalBalances(debts, payments)` → monthly balance array
  - `generateProjection(currentDebts, strategy, months)` → projected balances
  - `formatChartData(historical, projection)` → chart-ready data
  - `getDebtColors(debtCount, theme)` → color palette for multiple debts

**Step 3: Add Theme Colors for Individual Debts**
- Extend theme config to include color palette for charts
- Use existing semantic colors: income, expense, transfer, primary, secondary, accent, success, warning, error
- Create rotation function to cycle through colors for 10+ debts

### Phase 2: Frontend Components (Steps 4-7)

**Step 4: Create TotalDebtChart Component**
- Build Recharts `ComposedChart` (lines + area)
- Two lines: Projected (dashed, muted) and Actual (solid, income color)
- Area fill under actual line with gradient
- Format Y-axis with currency abbreviations (e.g., "$50K")
- Format X-axis with month abbreviations
- Responsive sizing using Recharts ResponsiveContainer
- Handle empty data state
- Files:
  - `components/debts/total-debt-chart.tsx`

**Step 5: Create IndividualDebtsChart Component**
- Build Recharts `AreaChart` with stacked areas
- Each debt as separate area with unique color
- Custom legend component showing debt names
- Interactive: Toggle debt visibility on legend click
- Tooltip showing all debts at month
- Responsive sizing
- Handle 2-10+ debts gracefully
- Files:
  - `components/debts/individual-debts-chart.tsx`

**Step 6: Create DebtReductionSummary Component**
- Display key metrics:
  - Total paid to date (formatted with green color)
  - Percentage complete (using ProgressRing or ProgressBar)
  - Months until debt-free
  - Debt-free date
  - Total original vs current comparison (side-by-side)
- Use CSS Grid (2-3 columns on desktop, 1 on mobile)
- Each metric in its own card with subtle background
- Files:
  - `components/debts/debt-reduction-summary.tsx`

**Step 7: Create DebtReductionChart Container**
- Location: `components/debts/debt-reduction-chart.tsx`
- Responsibilities:
  - Fetch data from `/api/debts/reduction-chart`
  - Manage loading/error states with skeleton loaders
  - Toggle between chart views (combined vs individual)
  - Render both summary and charts in organized layout
  - Use Suspense for data loading
- Layout (desktop):
  - Summary: 4 stat cards at top
  - Charts: Two sections side-by-side (Total Debt | Individual Debts)
  - Each with title, chart, and toggle button
- Layout (mobile):
  - Summary: Stacked cards
  - Charts: Single view, toggleable
  - Smaller height (300px instead of 400px)

### Phase 3: Integration (Steps 8-9)

**Step 8: Integrate into Debts Page**
- Add collapsible section above "What-If Scenario Calculator"
- Title: "Debt Reduction Progress"
- Chevron toggle icon
- Smooth expand/collapse animation
- Only show when user has active debts and history data
- Files:
  - `app/dashboard/debts/page.tsx` (update)

**Step 9: Update Features Documentation**
- Mark feature #8 as complete in `docs/features.md`
- Add implementation details to completion note
- Files:
  - `docs/features.md` (update)

### Phase 4: Polish & Testing (Steps 10-12)

**Step 10: Add Animations & Interactions**
- Smooth chart data transitions (500ms)
- Hover effects on chart points
- Legend item hover highlighting
- Celebration effect at payoff point (optional: confetti, color pulse)
- Keyboard navigation (Tab through legend items)
- Files:
  - Components from Phase 2 (enhance)

**Step 11: Responsive Design Testing**
- Test on mobile (375px width)
- Test on tablet (768px width)
- Test on desktop (1024px+)
- Verify chart readability at all sizes
- Check legend positioning
- Test touch interactions on mobile

**Step 12: Edge Cases & Error Handling**
- No debts: Show empty state with encouraging message
- One debt: Show combined chart (no benefit to individual chart)
- New user (no payment history): Show only projection
- Recently paid debt: Show completion celebration
- Large number of debts (10+): Handle color rotation gracefully
- Performance: Test with 1-5 years of history data

## Technical Specifications

### Dependencies
- `recharts@3.3.0` (already in project)
- `date-fns@3.x` (for date formatting - verify if already installed)

### Performance Considerations
- **API Caching**: Cache chart data for 1 hour (user probably won't make multiple debt payments in an hour)
- **Chart Data Size**: Limit historical data to last 36 months + 24 month projection
- **Calculation Optimization**: Use memoization for `calculateHistoricalBalances` if called frequently
- **Virtual Scrolling**: Not needed (fixed data size)

### Browser Compatibility
- Recharts works on all modern browsers
- Uses standard CSS variables (supported in all modern browsers)
- Test on Chrome, Firefox, Safari, Edge

### Accessibility
- Chart title with `role="img"` and descriptive aria-label
- Legend items focusable and keyboard navigable
- Color not the only differentiator (use patterns or labels)
- Sufficient contrast between colors and backgrounds
- Touch-friendly legend items (min 44px height)

## File Structure Summary

```
app/
├── api/
│   └── debts/
│       └── reduction-chart/
│           └── route.ts (NEW)
├── dashboard/
│   └── debts/
│       └── page.tsx (UPDATE)

components/
└── debts/
    ├── debt-reduction-chart.tsx (NEW - main container)
    ├── total-debt-chart.tsx (NEW - projected vs actual)
    ├── individual-debts-chart.tsx (NEW - stacked areas)
    └── debt-reduction-summary.tsx (NEW - stats cards)

lib/
├── debts/
│   ├── payoff-calculator.ts (reuse)
│   └── reduction-chart-utils.ts (NEW - helper functions)
└── themes/
    └── theme-config.ts (may need minor update for colors)

docs/
├── features.md (UPDATE)
└── debt-reduction-chart-plan.md (THIS FILE)
```

## Success Criteria

✅ Completion requires:
- [ ] API endpoint returns accurate historical and projected balances
- [ ] Total debt chart shows projected vs actual with area fill
- [ ] Individual debts chart shows stacked areas with proper coloring
- [ ] Summary section displays all 5 key metrics
- [ ] Charts responsive on mobile, tablet, desktop
- [ ] All theme variables used for colors (no hardcoded hex)
- [ ] Smooth animations on data updates
- [ ] Error states handled gracefully
- [ ] Empty state message for users with no debt history
- [ ] Feature marked complete in features.md
- [ ] Documentation added to this file

## Theme Integration Checklist

- [ ] Background: `var(--color-card)`
- [ ] Border: `var(--color-border)`
- [ ] Text (primary): `var(--color-foreground)`
- [ ] Text (secondary): `var(--color-muted-foreground)`
- [ ] Projected line: `var(--color-muted-foreground)` (dashed)
- [ ] Actual line: `var(--color-income)` (solid, prominent)
- [ ] Area fill: `color-mix(in oklch, var(--color-income) 20%, transparent)`
- [ ] Individual debt colors: Rotate through theme palette
- [ ] Summary stat highlight: `var(--color-primary)` or `var(--color-income)`
- [ ] Hover states: `var(--color-elevated)`
- [ ] Dark Mode: All variables tested
- [ ] Dark Pink Theme: All variables tested

## Next Steps

Once this plan is approved, implementation will begin with **Step 1: Create `/api/debts/reduction-chart` Endpoint** in Phase 1.
