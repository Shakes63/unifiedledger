# Interactive Amortization Schedule - Implementation Plan

## Feature Overview
Expand the current limited PayoffTimeline component into a comprehensive, interactive amortization schedule viewer with full month-by-month breakdowns, visual charts, and interactive exploration features.

## Current State
- **PayoffTimeline Component** (`components/debts/payoff-timeline.tsx`): Shows only first 3 and last payment for each debt
- **PayoffCalculator** (`lib/debts/payoff-calculator.ts`): Already generates complete `monthlyBreakdown` arrays with all payment data
- **Existing Charts**: AreaChart, ComposedChart, LineChart components already available using Recharts
- **Design System**: Dark mode (#0a0a0a background, #1a1a1a cards, #2a2a2a borders)

## Goals
1. **Full Amortization Table**: View all payments, not just first 3 and last
2. **Principal vs Interest Chart**: Visual representation of payment composition over time
3. **Interactive Month Details**: Click any month to see detailed breakdown and projections
4. **Debt Payoff Highlights**: Visual markers when each debt gets paid off
5. **Performance**: Handle long schedules efficiently (360+ months for 30-year mortgages)

---

## Implementation Steps

### Phase 1: Full Amortization Table Component

#### Step 1.1: Create AmortizationTable Component
**File**: `components/debts/amortization-table.tsx`

**Features**:
- Display all monthly payments in scrollable table
- Columns: Month, Payment, Principal, Interest, Balance
- Color-coding: Principal (green), Interest (red), Balance (white)
- Virtual scrolling for performance (use `react-window` or similar)
- Sticky header with column labels
- Responsive design for mobile (collapse to cards)

**Props**:
```typescript
interface AmortizationTableProps {
  schedule: DebtPayoffSchedule;
  startMonth?: number;
  highlightPayoffMonth?: boolean;
  onMonthClick?: (monthIndex: number) => void;
  className?: string;
}
```

**Visual Design**:
- Table container: `bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]`
- Header row: `bg-[#242424] sticky top-0 font-semibold text-[#808080]`
- Data rows: `hover:bg-[#242424] cursor-pointer transition-colors`
- Alternating row shading for readability
- Final payoff row: Special styling with celebration indicator

**Accessibility**:
- Keyboard navigation (arrow keys, enter to select)
- ARIA labels for screen readers
- Focus indicators

---

#### Step 1.2: Add Pagination/Virtual Scrolling
**Library**: Consider using `react-window` or implement custom pagination

**Options**:
1. **Virtual Scrolling** (recommended for smooth UX):
   - Only render visible rows + buffer
   - Handles 360+ rows efficiently
   - Library: `react-window` or `@tanstack/react-virtual`

2. **Pagination** (simpler but less smooth):
   - 50-100 rows per page
   - Page controls at bottom
   - Jump to specific month

**Decision**: Use virtual scrolling for better UX

---

#### Step 1.3: Add Table Controls
**Features**:
- **View Toggle**: Compact vs Detailed view
- **Export Button**: Export to CSV
- **Jump to Month**: Input to jump to specific month
- **Search**: Filter by month number or balance range

**UI Location**: Above table in header section

---

### Phase 2: Principal vs Interest Chart

#### Step 2.1: Create PrincipalInterestChart Component
**File**: `components/debts/principal-interest-chart.tsx`

**Chart Type**: Stacked Area Chart (using existing AreaChart component)

**Data Transformation**:
```typescript
const chartData = schedule.monthlyBreakdown.map((payment, index) => ({
  name: `Mo ${startMonth + index + 1}`,
  principal: payment.principalAmount,
  interest: payment.interestAmount,
  balance: payment.remainingBalance,
}));
```

**Features**:
- Stacked areas showing principal (green) and interest (red) portions
- Line overlay showing declining balance
- Interactive tooltip showing exact values
- X-axis: Month number
- Y-axis: Dollar amount
- Legend identifying Principal, Interest, Balance

**Props**:
```typescript
interface PrincipalInterestChartProps {
  schedule: DebtPayoffSchedule;
  startMonth?: number;
  className?: string;
  height?: number;
}
```

**Visual Design**:
- Use `ComposedChart` to combine stacked bars and line
- Principal: `#10b981` (emerald - existing income color)
- Interest: `#f87171` (red - existing expense color)
- Balance line: `#60a5fa` (blue - existing transfer color)
- Chart container styling matches existing charts

---

#### Step 2.2: Add Chart Interactivity
**Features**:
- Click/hover on any point to highlight that month
- Synchronize with table (scroll to month on click)
- Toggle between different views:
  - Stacked (principal + interest)
  - Side-by-side comparison
  - Balance line only

**Implementation**:
- Use Recharts' built-in click handlers
- Emit event to parent to sync with table
- State management for active month

---

#### Step 2.3: Multi-Debt View
**Feature**: Toggle between individual debt or cumulative view

**Cumulative View**:
- Show all debts stacked
- Different color for each debt
- Legend showing debt names
- Total balance line across all debts

**Individual View**:
- Dropdown to select specific debt
- Show only that debt's amortization

---

### Phase 3: Interactive Month Detail Modal

#### Step 3.1: Create MonthDetailModal Component
**File**: `components/debts/month-detail-modal.tsx`

**Trigger**: Click on any month row in table or chart point

**Data Displayed**:
```typescript
interface MonthDetails {
  monthNumber: number;
  absoluteMonth: number; // startMonth + monthNumber
  date: Date;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;

  // Calculated fields
  percentPaidOff: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  monthsRemaining: number;

  // Debt info
  debtName: string;
  originalBalance: number;
}
```

**UI Sections**:
1. **Header**: Month X of Y • Debt Name
2. **Payment Breakdown** (pie chart):
   - Principal portion (%)
   - Interest portion (%)
3. **Progress Indicators**:
   - Progress bar: X% paid off
   - Months remaining: Y months
4. **Cumulative Totals**:
   - Total paid so far: $X,XXX
   - Total interest paid: $X,XXX
   - Original balance: $X,XXX
5. **Projected Balance**: $X,XXX remaining

**Visual Design**:
- Modal overlay: `bg-black/50`
- Modal content: `bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]`
- Use existing PieChart component for payment breakdown
- Use existing ProgressRing component for percent paid
- Close button (X) in top right
- Navigation buttons: Previous Month | Next Month

---

#### Step 3.2: Add Modal Navigation
**Features**:
- Arrow keys to navigate between months
- Previous/Next buttons
- Close on Escape key or backdrop click
- Animation: Slide/fade in-out

---

### Phase 4: Debt Payoff Highlights

#### Step 4.1: Add Payoff Markers to Table
**Visual Indicators**:
- Final payment row for each debt:
  - Background: `bg-gradient-to-r from-[#10b981]/20 to-transparent`
  - Border: `border-l-4 border-[#10b981]`
  - Icon: 🎉 celebration emoji
  - Text: "PAID OFF" badge

**Implementation**:
- Detect when `remainingBalance === 0`
- Apply special styling to that row
- Add tooltip: "Debt paid off!"

---

#### Step 4.2: Add Payoff Timeline Markers
**Chart Enhancements**:
- Vertical line markers on chart at payoff months
- Color-coded per debt (use debt's assigned color)
- Label showing debt name at payoff point
- Animate marker on hover

**Implementation**:
```typescript
// In chart data
const payoffMarkers = schedules.map(schedule => ({
  month: startMonth + schedule.monthsToPayoff,
  debtName: schedule.debtName,
  color: schedule.color || '#60a5fa',
}));
```

- Use Recharts `ReferenceLine` component for vertical markers

---

#### Step 4.3: Milestone Celebrations
**Trigger Points**:
- 25% paid off (🏅)
- 50% paid off (🥈)
- 75% paid off (🥇)
- 100% paid off (🎉)

**Visual Indicators**:
- Badge/icon in Balance column when milestone reached
- Subtle highlight on row
- Tooltip explaining milestone

**Implementation**:
- Calculate milestones based on originalBalance
- Check currentBalance against thresholds
- Add indicator column or inline badge

---

### Phase 5: Performance Optimization

#### Step 5.1: Implement Virtual Scrolling
**Library**: `@tanstack/react-virtual` (lightweight, modern)

**Benefits**:
- Handle 360+ month schedules smoothly
- Render only visible rows (+ small buffer)
- 60fps scrolling performance

**Implementation**:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: monthlyBreakdown.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48, // Row height in pixels
  overscan: 5, // Buffer rows
});
```

---

#### Step 5.2: Memoization & Optimization
**Strategies**:
- Memoize chart data transformations
- Use `React.memo` for row components
- Debounce search/filter inputs
- Lazy load chart components (code splitting)

**Implementation**:
```typescript
const chartData = useMemo(() => {
  return schedule.monthlyBreakdown.map((payment, index) => ({
    // ... transform data
  }));
}, [schedule.monthlyBreakdown, startMonth]);
```

---

### Phase 6: Additional Features

#### Step 6.1: Export Functionality
**Formats**:
- CSV export (full schedule)
- PDF export (formatted table)
- Copy to clipboard (TSV format)

**UI**: Button in table header "Export ▾"

**Implementation**:
- CSV: Use `papaparse` (already in dependencies)
- PDF: Consider `jspdf` or browser print
- Clipboard: `navigator.clipboard.writeText()`

---

#### Step 6.2: Comparison Mode
**Feature**: Compare two different scenarios side-by-side

**Use Case**:
- Current plan vs bi-weekly payments
- Current plan vs extra $100/month
- Snowball vs Avalanche

**UI**:
- Split screen layout
- Two tables/charts side by side
- Highlight differences in key metrics

**Implementation**:
- Accept second schedule as prop
- Render two instances with comparison indicators
- Shared hover/selection state

---

#### Step 6.3: Print-Friendly View
**Feature**: Optimized layout for printing

**Considerations**:
- Remove dark backgrounds (use white for print)
- Collapse to single column
- Page breaks at logical points
- Include summary header with debt info

**Implementation**:
- CSS `@media print` styles
- "Print" button that opens print dialog
- Option to generate PDF instead

---

## Integration Plan

### Update PayoffTimeline Component
**Option 1**: Replace entirely with new AmortizationTable
**Option 2**: Keep both, add tabs to switch views

**Recommendation**: Option 2 - Keep existing timeline as "Overview" tab

**Tab Layout**:
1. **Overview** (existing PayoffTimeline): Visual timeline bars + limited table
2. **Full Schedule**: New AmortizationTable with all months
3. **Charts**: Principal vs Interest visualizations
4. **Analysis**: Additional insights (coming in future)

---

### Add to Debts Page
**File**: `app/dashboard/debts/page.tsx`

**Placement**:
- Keep existing sections (Countdown, Adherence, Streak, Warning, What-If, Strategy)
- Add new "Amortization Schedule" section between Strategy and Debts list
- Make it collapsible (like other sections)

**Integration**:
```typescript
<CollapsibleSection
  title="Amortization Schedule"
  icon="📊"
  defaultOpen={false}
>
  <AmortizationScheduleView
    strategy={strategy}
    paymentFrequency={settings.paymentFrequency}
  />
</CollapsibleSection>
```

---

### Create Container Component
**File**: `components/debts/amortization-schedule-view.tsx`

**Purpose**: Orchestrate all sub-components

**Structure**:
```typescript
export function AmortizationScheduleView({ strategy }: Props) {
  const [activeDebt, setActiveDebt] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [view, setView] = useState<'overview' | 'table' | 'chart'>('overview');

  return (
    <div>
      {/* Debt Selector (if multiple debts) */}
      <DebtSelector debts={strategy.payoffOrder} active={activeDebt} onChange={setActiveDebt} />

      {/* View Tabs */}
      <Tabs value={view} onChange={setView}>
        <Tab value="overview">Overview</Tab>
        <Tab value="table">Full Schedule</Tab>
        <Tab value="chart">Charts</Tab>
      </Tabs>

      {/* Content */}
      {view === 'overview' && <PayoffTimeline strategy={strategy} />}
      {view === 'table' && (
        <AmortizationTable
          schedule={strategy.schedules[activeDebt]}
          onMonthClick={setSelectedMonth}
        />
      )}
      {view === 'chart' && (
        <PrincipalInterestChart
          schedule={strategy.schedules[activeDebt]}
        />
      )}

      {/* Month Detail Modal */}
      {selectedMonth !== null && (
        <MonthDetailModal
          schedule={strategy.schedules[activeDebt]}
          monthIndex={selectedMonth}
          onClose={() => setSelectedMonth(null)}
        />
      )}
    </div>
  );
}
```

---

## Design System Compliance

### Colors
- **Background**: `#0a0a0a` (page)
- **Surface**: `#1a1a1a` (cards)
- **Elevated**: `#242424` (hover states)
- **Border**: `#2a2a2a` (dividers)
- **Principal**: `#10b981` (emerald/green)
- **Interest**: `#f87171` (red)
- **Balance**: `#60a5fa` (blue)
- **Text Primary**: `#ffffff` (white)
- **Text Secondary**: `#808080` (gray)

### Typography
- **Headers**: Inter font, semibold
- **Numbers**: JetBrains Mono font (monospaced for alignment)
- **Body**: Inter font, regular

### Border Radius
- **Cards**: `rounded-xl` (12px)
- **Buttons**: `rounded-lg` (8px)
- **Inputs**: `rounded-md` (6px)

### Spacing
- **Card Padding**: `p-6` (24px)
- **Section Gap**: `gap-6` (24px)
- **Element Gap**: `gap-3` (12px)

---

## Dependencies

### Existing (Already Installed)
- `recharts@3.3.0` - Charts
- `papaparse@5.5.3` - CSV export
- `decimal.js@10.6.0` - Financial calculations

### New (To Install)
- `@tanstack/react-virtual@3.10.8` - Virtual scrolling

**Install Command**:
```bash
pnpm add @tanstack/react-virtual
```

---

## Testing Strategy

### Unit Tests
- AmortizationTable component renders all rows
- Chart data transformation correctness
- Month detail calculations (percent paid, totals)
- Export functionality produces valid CSV

### Integration Tests
- Click month row → modal opens with correct data
- Chart point click → table scrolls to month
- Tab switching preserves state
- Debt selector changes displayed data

### Performance Tests
- Virtual scrolling handles 360 rows smoothly
- Chart rendering under 100ms
- No memory leaks with modal open/close
- Search/filter response time < 50ms

### Manual Testing
- Mobile responsiveness (table → cards)
- Keyboard navigation works
- Print layout looks good
- Accessibility (screen reader)

---

## File Structure

```
components/
  debts/
    amortization-schedule-view.tsx        # Main container (NEW)
    amortization-table.tsx                # Full table (NEW)
    principal-interest-chart.tsx          # P&I chart (NEW)
    month-detail-modal.tsx                # Detail modal (NEW)
    debt-selector.tsx                     # Debt dropdown (NEW)
    payoff-timeline.tsx                   # Existing (keep for overview)

  ui/
    tabs.tsx                              # Tab component (NEW - if not exists)

app/
  dashboard/
    debts/
      page.tsx                            # Update to add new section
```

---

## Implementation Checklist

### Phase 1: Full Amortization Table
- [ ] Create AmortizationTable component with basic styling
- [ ] Add virtual scrolling with @tanstack/react-virtual
- [ ] Implement row click handler
- [ ] Add sticky header
- [ ] Style payoff row with celebration
- [ ] Add mobile responsive view (table → cards)
- [ ] Test with 360-month schedule (30-year mortgage)

### Phase 2: Principal vs Interest Chart
- [ ] Create PrincipalInterestChart component
- [ ] Transform monthlyBreakdown data for chart
- [ ] Implement stacked area chart
- [ ] Add balance line overlay
- [ ] Add interactive tooltip
- [ ] Implement chart click → table scroll sync
- [ ] Test with multiple debt schedules

### Phase 3: Interactive Month Details
- [ ] Create MonthDetailModal component
- [ ] Calculate derived fields (percent paid, cumulative totals)
- [ ] Add pie chart for payment breakdown
- [ ] Add progress indicators
- [ ] Implement prev/next navigation
- [ ] Add keyboard shortcuts (arrows, escape)
- [ ] Add animations (fade/slide)

### Phase 4: Debt Payoff Highlights
- [ ] Style final payoff rows in table
- [ ] Add celebration indicators (🎉)
- [ ] Add vertical markers to chart
- [ ] Implement milestone badges (25%, 50%, 75%)
- [ ] Add tooltips explaining milestones

### Phase 5: Container & Integration
- [ ] Create AmortizationScheduleView container
- [ ] Add debt selector dropdown
- [ ] Implement tab navigation (Overview/Table/Chart)
- [ ] Connect all components with shared state
- [ ] Add export functionality (CSV)
- [ ] Integrate into debts page as collapsible section

### Phase 6: Polish & Testing
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Implement print styles
- [ ] Write unit tests
- [ ] Test accessibility
- [ ] Test mobile responsiveness
- [ ] Performance optimization (memoization)
- [ ] Documentation

---

## Success Criteria

1. **Performance**: Smooth scrolling with 360+ month schedules
2. **Usability**: All interactions feel intuitive and responsive
3. **Accuracy**: All calculations match existing payoff calculator
4. **Accessibility**: Keyboard navigation and screen reader support
5. **Mobile**: Fully functional on small screens
6. **Design**: Consistent with existing dark mode design system
7. **Integration**: Seamlessly fits into existing debts page

---

## Future Enhancements (Not in Initial Release)

1. **What-If Inline Editing**: Click any month to change payment amount, see instant recalculation
2. **Payment History Overlay**: Show actual payments vs projected on same chart
3. **Refinance Calculator**: Test impact of refinancing at different interest rates
4. **Extra Payment Optimizer**: AI-suggested optimal months for lump sum payments
5. **Print Templates**: Multiple print layouts (detailed, summary, one-page)
6. **Mobile App Integration**: Offline capability, push notifications at milestones
7. **Sharing**: Generate shareable links with read-only access

---

## Estimated Timeline

- **Phase 1**: 8-10 hours (AmortizationTable)
- **Phase 2**: 6-8 hours (Charts)
- **Phase 3**: 6-8 hours (Month Details)
- **Phase 4**: 4-6 hours (Highlights)
- **Phase 5**: 4-6 hours (Integration)
- **Phase 6**: 4-6 hours (Polish & Testing)

**Total**: ~35-45 hours

---

## Next Steps

1. Install @tanstack/react-virtual dependency
2. Create AmortizationTable component (Phase 1, Step 1.1)
3. Test with existing PayoffStrategyResult data
4. Iterate based on visual design feedback
