# Feature #9: Principal vs Interest Pie Chart - Implementation Plan

## Overview
Add pie chart visualizations to show the principal vs interest breakdown at different stages of debt repayment, helping users understand how payment composition changes over time and the true cost of their debt.

## Current State Analysis

### Existing Components
- ✅ `PrincipalInterestChart` - Bar/line chart showing breakdown over time
- ✅ `AmortizationScheduleView` - Container with multiple view modes
- ✅ `MonthDetailModal` - Modal showing detailed breakdown for a single month
- ✅ Payoff calculator with detailed `MonthlyPayment` data structures
- ✅ Theme system with semantic color variables

### Existing Data Structures
```typescript
interface MonthlyPayment {
  debtId: string;
  debtName: string;
  paymentAmount: number;
  principalAmount: number;
  interestAmount: number;
  remainingBalance: number;
}

interface DebtPayoffSchedule {
  debtId: string;
  debtName: string;
  originalBalance: number;
  monthsToPayoff: number;
  totalInterestPaid: number;
  monthlyBreakdown: MonthlyPayment[];
}
```

### Integration Points
- Debts page (`app/dashboard/debts/page.tsx`)
- Amortization schedule section (already has collapsible UI)
- Existing color variables: `--color-chart-principal` (green), `--color-chart-interest` (red)

## Feature Requirements

### 1. Payment Comparison Pie Charts
Show how payment composition changes over the life of the loan:
- **First Payment** - High interest, low principal (early in term)
- **Midpoint Payment** - More balanced split
- **Final Payment** - High principal, minimal interest
- Side-by-side comparison with percentages and dollar amounts

### 2. Total Interest Pie Chart
Show the overall cost breakdown:
- Total principal (original debt)
- Total interest paid (cost of borrowing)
- Display as percentage and dollar amounts
- Highlight the "true cost" of the debt

### 3. Current Progress Pie Chart (Bonus)
Show progress toward payoff:
- Amount already paid off
- Remaining balance
- Can show current position in the payoff journey

## Design Specifications

### Color Scheme (Using Theme Variables)
- **Principal**: `var(--color-chart-principal)` - Green/turquoise
- **Interest**: `var(--color-chart-interest)` - Red/pink
- **Paid Off**: `var(--color-success)` - Success green
- **Remaining**: `var(--color-muted-foreground)` - Muted gray
- **Backgrounds**: `bg-card`, `bg-elevated`
- **Borders**: `border-border`
- **Text**: `text-foreground`, `text-muted-foreground`

### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│  Principal vs Interest Breakdown                        │
│  ═════════════════════════════════════════              │
│                                                          │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐              │
│  │  First  │  │ Midpoint │  │   Last   │              │
│  │ Payment │  │ Payment  │  │ Payment  │              │
│  │         │  │          │  │          │              │
│  │  [PIE]  │  │  [PIE]   │  │  [PIE]   │              │
│  │         │  │          │  │          │              │
│  │ 🔴 80%  │  │ 🔴 35%   │  │ 🔴 5%    │              │
│  │ 🟢 20%  │  │ 🟢 65%   │  │ 🟢 95%   │              │
│  └─────────┘  └──────────┘  └──────────┘              │
│                                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                                          │
│  Total Cost Breakdown              💡 Insight Box      │
│  ┌────────────────────┐            ┌──────────────┐   │
│  │                    │            │              │   │
│  │    [LARGE PIE]     │            │  Making      │   │
│  │                    │            │  extra       │   │
│  │  Principal: 65%    │            │  payments    │   │
│  │  Interest:  35%    │            │  early...    │   │
│  │                    │            │              │   │
│  └────────────────────┘            └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Responsive Behavior
- **Desktop**: 3-column grid for payment comparison, 2-column for total/insight
- **Tablet**: 2-column grid for payment comparison, stack total/insight
- **Mobile**: Single column, smaller pie charts

## Implementation Steps

### Step 1: Create PaymentComparisonPieCharts Component
**File**: `components/debts/payment-comparison-pie-charts.tsx`

**Purpose**: Display 3 pie charts comparing first, midpoint, and final payments

**Props**:
```typescript
interface PaymentComparisonPieChartsProps {
  schedule: DebtPayoffSchedule;
  className?: string;
}
```

**Implementation Details**:
- Calculate indices: first (0), midpoint (Math.floor(length/2)), last (length-1)
- Extract payment data from `schedule.monthlyBreakdown`
- Use Recharts PieChart with 2 segments (principal, interest)
- Display percentage and dollar amounts
- Custom labels showing percentages
- Responsive grid layout (3 cols desktop, 2 cols tablet, 1 col mobile)
- Height: 200px per chart on mobile, 250px on desktop
- Use `RADIAN` constant for label positioning
- Add tooltips with full details

**Key Features**:
- Clear headers: "First Payment", "Midpoint", "Final Payment"
- Color-coded legends with emoji indicators
- Percentage display prominently
- Dollar amounts in monospace font
- Gradient fills for visual appeal

### Step 2: Create TotalCostPieChart Component
**File**: `components/debts/total-cost-pie-chart.tsx`

**Purpose**: Show overall principal vs total interest paid

**Props**:
```typescript
interface TotalCostPieChartProps {
  schedule: DebtPayoffSchedule;
  className?: string;
}
```

**Implementation Details**:
- Calculate: principal = `schedule.originalBalance`
- Calculate: interest = `schedule.totalInterestPaid`
- Large pie chart (350px height on desktop, 250px mobile)
- Prominent center label showing total paid
- Display interest multiplier: "You'll pay X.Xx times the original amount"
- Add "cost of borrowing" insight
- Show total paid, breakdown by category

**Key Features**:
- Larger visualization than comparison charts
- Bold statistics callouts
- Clear "true cost" messaging
- Interest rate impact explanation

### Step 3: Create PaymentBreakdownSection Container
**File**: `components/debts/payment-breakdown-section.tsx`

**Purpose**: Orchestrate all pie chart components with collapsible UI

**Props**:
```typescript
interface PaymentBreakdownSectionProps {
  strategy: PayoffStrategyResult;
  className?: string;
}
```

**Implementation Details**:
- Collapsible section (default: collapsed to save space)
- Header with toggle button (ChevronDown/ChevronUp)
- Support multiple debts with debt selector dropdown
- Section title: "Payment Breakdown Analysis"
- Description: "See how your payments split between principal and interest"
- Render `PaymentComparisonPieCharts` component
- Render `TotalCostPieChart` component
- Add insight box with actionable advice

**Layout Structure**:
```tsx
<Collapsible>
  <Header with toggle />
  {hasMultipleDebts && <DebtSelector />}
  <PaymentComparisonPieCharts />
  <Divider />
  <Grid 2-columns>
    <TotalCostPieChart />
    <InsightBox />
  </Grid>
</Collapsible>
```

**Styling**:
- Background: `bg-card`
- Border: `border-border`
- Border radius: `rounded-xl` (12px)
- Padding: `p-6`
- Spacing: `space-y-6`
- Use elevation for depth: `hover:bg-elevated`

### Step 4: Create Utility Functions (if needed)
**File**: `lib/debts/payment-breakdown-utils.ts`

**Functions**:
```typescript
// Calculate payment composition at different stages
export function getPaymentAtStage(
  schedule: DebtPayoffSchedule,
  stage: 'first' | 'midpoint' | 'last'
): MonthlyPayment | null;

// Format percentage for display
export function formatPercentage(value: number, total: number): string;

// Calculate interest multiplier
export function calculateInterestMultiplier(
  principal: number,
  totalInterest: number
): number;

// Generate insight message based on interest rate
export function generatePaymentInsight(
  schedule: DebtPayoffSchedule
): string;
```

### Step 5: Integrate into Debts Page
**File**: `app/dashboard/debts/page.tsx`

**Integration Point**: After Payment Tracking section, before Amortization Schedule

**Changes**:
1. Import `PaymentBreakdownSection` component
2. Add section between existing components:
   ```tsx
   {/* Payment Tracking */}
   <PaymentAdherenceCard />
   <PaymentStreakWidget />

   {/* NEW: Payment Breakdown */}
   {payoffStrategy && (
     <PaymentBreakdownSection strategy={payoffStrategy} />
   )}

   {/* Debt Reduction Chart */}
   <DebtReductionChart />
   ```
3. Ensure proper spacing and responsive layout
4. Pass `payoffStrategy` prop (already available in state)

### Step 6: Add Chart Color Variables (if needed)
**File**: `app/globals.css`

**Check existing variables**:
- `--color-chart-principal` ✅ (already exists for green)
- `--color-chart-interest` ✅ (already exists for red)
- `--color-chart-balance` (if needed for remaining balance)

**If needed, add**:
```css
--color-chart-paid: var(--color-success);
--color-chart-remaining: var(--color-muted-foreground);
```

### Step 7: Testing & Refinement

**Test Cases**:
1. ✅ Single debt with short payoff (12-24 months)
2. ✅ Single debt with long payoff (5-30 years)
3. ✅ Multiple debts with different interest rates
4. ✅ High interest rate (20%+) showing dramatic interest cost
5. ✅ Low/no interest showing minimal interest
6. ✅ Responsive design on mobile, tablet, desktop
7. ✅ Theme switching (Dark Mode, Dark Pink Theme)
8. ✅ Collapsible behavior
9. ✅ Chart interactions (hover, tooltips)
10. ✅ Edge cases: single payment, very short term

**Manual Testing**:
- Visual appearance matches design system
- Colors use theme variables consistently
- Responsive breakpoints work smoothly
- Performance is good (no lag)
- Tooltips show correct data
- Percentages and amounts match calculations

### Step 8: Update Documentation
**File**: `docs/features.md`

**Update Feature #9**:
```markdown
9. ✅ Principal vs Interest Pie Chart (COMPLETED)

  For each debt, show:
  - How much of each payment goes to principal vs interest
  - Visual comparison early vs late in loan term
  - Total interest paid vs remaining

  Implementation complete with:
  - **PaymentComparisonPieCharts**: Side-by-side comparison of first, midpoint, and final payments
  - **TotalCostPieChart**: Overall cost breakdown showing true cost of borrowing
  - **PaymentBreakdownSection**: Collapsible container with debt selector support
  - **Theme Integration**: All colors use CSS variables for consistency
  - **Responsive Design**: Works on mobile, tablet, and desktop
  - **Interactive Features**: Tooltips, hover effects, percentage calculations
  - **Utility Functions**: Helpers for stage calculations and insights
  - **Integrated on Debts Page**: Positioned between Payment Tracking and Amortization
```

## Technical Considerations

### Performance
- Memoize calculations with `useMemo` for expensive operations
- Keep pie chart data minimal (2-3 segments each)
- Lazy render: only show when section expanded
- Virtual scrolling not needed (small dataset)

### Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation for collapsible section
- Screen reader friendly tooltips
- Sufficient color contrast (4.5:1 minimum)
- Focus indicators on buttons

### Browser Compatibility
- Recharts works in all modern browsers
- CSS Grid with fallbacks
- Flexbox for older browsers
- Test in Safari, Chrome, Firefox

### Error Handling
- Handle missing/null schedule data gracefully
- Show empty state if no payment data
- Handle division by zero in percentage calculations
- Validate data before rendering

### Data Validation
```typescript
// Check schedule exists and has data
if (!schedule || !schedule.monthlyBreakdown?.length) {
  return <EmptyState />;
}

// Ensure indices are valid
const midpointIndex = Math.min(
  Math.floor(schedule.monthlyBreakdown.length / 2),
  schedule.monthlyBreakdown.length - 1
);
```

## File Structure Summary

```
components/debts/
├── payment-comparison-pie-charts.tsx  (NEW - Step 1)
├── total-cost-pie-chart.tsx           (NEW - Step 2)
└── payment-breakdown-section.tsx      (NEW - Step 3)

lib/debts/
└── payment-breakdown-utils.ts         (NEW - Step 4, optional)

app/dashboard/debts/
└── page.tsx                           (MODIFIED - Step 5)

app/
└── globals.css                        (CHECK - Step 6)

docs/
└── features.md                        (UPDATE - Step 8)
```

## Estimated Effort
- **Step 1**: 1.5 hours - PaymentComparisonPieCharts component
- **Step 2**: 1 hour - TotalCostPieChart component
- **Step 3**: 1 hour - PaymentBreakdownSection container
- **Step 4**: 0.5 hours - Utility functions
- **Step 5**: 0.5 hours - Integration into debts page
- **Step 6**: 0.25 hours - Check/add color variables
- **Step 7**: 1 hour - Testing and refinement
- **Step 8**: 0.25 hours - Documentation update

**Total**: ~6 hours

## Success Criteria
- ✅ Users can see payment composition at first, midpoint, and final payments
- ✅ Total cost breakdown clearly shows interest vs principal
- ✅ Visual comparison makes it obvious how payment composition changes
- ✅ Integrates seamlessly with existing debt management UI
- ✅ Uses theme variables consistently (no hardcoded colors)
- ✅ Responsive on all screen sizes
- ✅ Collapsible to avoid cluttering the page
- ✅ Performance is smooth (no lag)
- ✅ Accessible to screen readers and keyboard users

## Future Enhancements (Not in Scope)
- Interactive "slider" to see any month's breakdown
- Animation when expanding/collapsing
- Export chart as image
- Compare multiple debts side-by-side
- Show progress pie chart (paid vs remaining)
- Historical tracking of how composition has changed

## Notes
- This feature complements the existing `PrincipalInterestChart` (bar chart) by showing pie charts for specific points in time
- The bar chart shows trends over time; pie charts show snapshots
- Together they provide comprehensive understanding of payment breakdown
- Focus on clarity and actionable insights, not just data visualization
- Keep UI clean and uncluttered - use collapsible sections
- Ensure all calculations use Decimal.js for precision (already done in calculator)

## Dependencies
- ✅ Recharts (already installed)
- ✅ Decimal.js (already installed)
- ✅ Existing payoff calculator
- ✅ Theme system
- ✅ UI components (Collapsible, Button, etc.)

## Risk Assessment
- **Low Risk**: Well-understood data structures, existing patterns to follow
- **Medium Complexity**: Multiple components but clear responsibilities
- **High Value**: Users frequently ask "where does my money go?"
- **Good Foundation**: Existing chart components and theme system make this straightforward
