# Dashboard Redesign - Condensed & Focused Layout

## Objective
Redesign the main dashboard to be more focused and less cluttered, with emphasis on:
1. Bills due this month (primary focus)
2. Transaction entry (quick action)
3. Recent transactions (immediate visibility)
4. Quick overview stats (condensed into single bar)

## Current Issues
- Too much vertical space taken up by multiple large cards
- Important information (bills, transaction entry) buried below fold
- Quick overview section takes up ~3-4 rows of cards
- Hard to see bills and recent transactions without scrolling

## Proposed Layout

### 1. **Compact Stats Bar** (Single Row)
A single horizontal bar with 4-5 key metrics in pill-style cards:
- **Total Balance** - Net worth across all accounts
- **Monthly Spending** - Current month expenses
- **Bills Due** - Count of pending bills this month
- **Budget Status** - Adherence percentage or score
- **Optional: Debt Progress** - If user has debts

**Design:**
- Single row, responsive grid (4-5 columns on desktop, 2 columns on mobile)
- Small, compact cards with icon + label + value
- Quick glance information only
- No dropdowns or interactive elements in stat bar
- Height: ~80-100px

### 2. **Primary Action: Add Transaction Button**
Keep prominent, move higher in layout:
- Large, full-width button
- Pink primary color (existing design)
- Position: Right after stats bar

### 3. **Bills This Month** (Expanded Priority Section)
Make this the star of the dashboard:
- Move to position #3 (after Add Transaction button)
- Show more bills (8-10 instead of 5)
- Larger, more readable layout
- Clear visual distinction between paid/pending/overdue
- Action buttons: "Mark as Paid", "View All Bills"
- Include mini calendar showing bill due dates
- **Design enhancements:**
  - Color-coded status badges
  - Progress bar showing bills paid vs pending
  - Quick stats: Total amount, paid amount, remaining
  - Sortable by date or amount

### 4. **Recent Transactions** (Keep Visible)
Position: Right after Bills section
- Show 5-8 transactions (configurable)
- Current design is good, keep it
- Ensure it's above the fold on most screens

### 5. **Secondary Information** (Collapsible/Condensed)
Move less critical widgets to bottom or make collapsible:
- Budget Summary Widget → Move to collapsible "Budget Details" section
- Credit Utilization → Move to collapsible "Debt & Credit" section
- Budget Surplus Card → Move to collapsible "Budget Details" section
- Debt Countdown Card → Move to collapsible "Debt & Credit" section

**Design:**
- Collapsible sections with header + expand/collapse button
- Default: Collapsed (only show if user expands)
- Or: Keep as smaller cards in a single row at bottom

### 6. **Accounts Overview** (Simplified)
Instead of full card, integrate into stats bar:
- Remove large accounts card
- Add "Accounts" link in navigation or quick actions
- Total balance shown in stats bar
- Individual accounts accessible via dropdown or separate page

## Implementation Tasks

### Task 1: Create Compact Stats Bar Component ✅ READY
**File:** `components/dashboard/compact-stats-bar.tsx` (NEW)

**Features:**
- Fetch data: total balance, monthly spending, bills due count, budget adherence
- 4-5 stat cards in horizontal grid
- Icons: Wallet (balance), TrendingUp (spending), Calendar (bills), Target (budget)
- Responsive: 2 columns mobile, 4-5 columns desktop
- Small text sizes (text-xs for label, text-lg for value)
- Theme variables for all colors

**API calls:**
- `/api/accounts` - Calculate total balance
- `/api/transactions` - Calculate monthly spending
- `/api/bills/instances` - Count pending bills
- `/api/budgets/overview` - Get budget adherence

**Design specs:**
- Height: 80px per card
- Padding: p-4
- Border radius: rounded-lg
- Grid gap: gap-3
- Background: bg-card with border-border

### Task 2: Create Enhanced Bills Widget Component ✅ READY
**File:** `components/dashboard/enhanced-bills-widget.tsx` (NEW)

**Features:**
- Show 8-10 bills (increased from 5)
- Mini calendar view showing bill due dates (optional enhancement)
- Progress indicator: X of Y bills paid
- Total amount / Paid amount / Remaining amount
- Color-coded status: Green (paid), Amber (pending), Red (overdue)
- Sort options: By date (default) or by amount
- Quick actions: "Mark as Paid" button per bill
- "View All Bills" link

**Design enhancements:**
- Larger cards (p-4 instead of p-3)
- More prominent status badges
- Progress bar at top showing % bills paid
- Clear visual hierarchy

**API calls:**
- `/api/bills/instances` - Get current month bills with expanded limit

### Task 3: Create Collapsible Section Component ✅ READY
**File:** `components/dashboard/collapsible-section.tsx` (NEW)

**Features:**
- Generic collapsible section with header
- Chevron icon that rotates when expanded/collapsed
- Smooth animation (300ms transition)
- localStorage persistence (remember expand/collapse state)
- Props: title, children, defaultExpanded, storageKey

**Design:**
- Header: flex justify-between, clickable, hover state
- Content: max-height animation or display toggle
- Use CSS variables for all colors

### Task 4: Update Main Dashboard Page ✅ READY
**File:** `app/dashboard/page.tsx`

**Changes:**
1. Remove existing "Quick Overview" section
2. Add CompactStatsBar component at top
3. Keep Add Transaction button (move up)
4. Replace BillsWidget with EnhancedBillsWidget
5. Keep RecentTransactions component (no changes)
6. Wrap secondary widgets in CollapsibleSection:
   - "Budget Details" section: BudgetSummaryWidget + BudgetSurplusCard
   - "Debt & Credit" section: CreditUtilizationWidget + DebtCountdownCard
7. Remove individual large cards from overview

**New layout order:**
```
1. CompactStatsBar (stats in one row)
2. Add Transaction Button (full width)
3. EnhancedBillsWidget (expanded, 8-10 bills)
4. RecentTransactions (5-8 transactions)
5. CollapsibleSection "Budget Details" (collapsed by default)
   - BudgetSummaryWidget
   - BudgetSurplusCard
6. CollapsibleSection "Debt & Credit" (collapsed by default)
   - CreditUtilizationWidget
   - DebtCountdownCard
```

### Task 5: Update Existing Widgets for Consistency ✅ READY
**Files:** Various widget files

**Changes:**
- Ensure all widgets use consistent padding (p-4 or p-6)
- Ensure all use theme variables
- Check responsive behavior
- Verify loading states

### Task 6: Mobile Responsiveness Testing ✅ READY
**Test on:**
- Mobile (320px - 640px)
- Tablet (640px - 1024px)
- Desktop (1024px+)

**Verify:**
- Stats bar wraps correctly (2 columns mobile)
- Bills widget is readable and scrollable
- Recent transactions look good
- Collapsible sections work on mobile
- Add Transaction button is easy to tap

### Task 7: Performance Optimization ✅ READY
**Optimizations:**
- Lazy load collapsible section contents (only fetch data when expanded)
- Add loading skeletons for stats bar
- Debounce any interactive elements
- Minimize re-renders with proper React.memo usage

### Task 8: Documentation & Testing ✅ READY
**Tasks:**
- Update `.claude/CLAUDE.md` with new dashboard structure
- Update `docs/features.md` to mark feature complete
- Test all API endpoints
- Verify theme compatibility (Dark Mode + Dark Pink Theme)
- Build verification

## Design System Compliance

**Color Variables to Use:**
- Background: `bg-card`, `bg-elevated`, `bg-background`
- Text: `text-foreground`, `text-muted-foreground`
- Borders: `border-border`
- Semantic: `--color-income`, `--color-expense`, `--color-success`, `--color-warning`, `--color-error`, `--color-primary`
- Icons: Lucide icons (no emojis)

**Spacing:**
- Card padding: `p-4` or `p-6`
- Grid gaps: `gap-3` or `gap-4`
- Section margins: `mb-6` or `mb-8`

**Border Radius:**
- Cards: `rounded-xl` (12px)
- Buttons: `rounded-lg` (8px)
- Small elements: `rounded-md` (6px)

**Typography:**
- Headers: `text-xl font-bold` or `text-lg font-semibold`
- Body: `text-sm` or `text-base`
- Labels: `text-xs`
- Use `text-foreground` for primary text, `text-muted-foreground` for secondary

## Success Criteria

1. ✅ Dashboard loads faster (fewer visible components on mount)
2. ✅ Bills and transactions visible without scrolling (on 1080p+ screens)
3. ✅ Stats bar shows all key metrics in single glance
4. ✅ Add Transaction button prominent and easy to find
5. ✅ Secondary information accessible but not cluttering primary view
6. ✅ Mobile experience is clean and usable
7. ✅ All theme variables used (no hardcoded colors)
8. ✅ Build successful with zero TypeScript errors

## Timeline Estimate

- Task 1 (CompactStatsBar): ~45 minutes
- Task 2 (EnhancedBillsWidget): ~60 minutes
- Task 3 (CollapsibleSection): ~30 minutes
- Task 4 (Update Dashboard): ~45 minutes
- Task 5 (Widget Updates): ~30 minutes
- Task 6 (Mobile Testing): ~30 minutes
- Task 7 (Performance): ~20 minutes
- Task 8 (Documentation): ~20 minutes

**Total: ~4.5 hours of development time**

## Visual Mockup (Text)

```
┌─────────────────────────────────────────────────────────────┐
│ [STATS BAR - Single Row]                                    │
│  💰 Balance    📈 Spending   📅 Bills Due   🎯 Budget      │
│  $5,420.50    $1,234.00     3 pending      87%             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  [➕ Add Transaction]                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ This Month's Bills                          [View All →]    │
│ ▓▓▓▓▓▓▓░░░ 7 of 10 paid                                   │
│                                                              │
│ ✅ Rent              Due Jan 1    $1,500.00  [Paid]        │
│ ⏰ Internet          Due Jan 5    $89.99     [Pending]      │
│ ⏰ Electric          Due Jan 10   $120.00    [Pending]      │
│ ⏰ Phone             Due Jan 15   $55.00     [Pending]      │
│ ... (up to 10 bills shown)                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Recent Transactions                         [View All →]    │
│                                                              │
│ 📤 Coffee Shop    -$5.50      Jan 8  • Food & Dining       │
│ 📥 Paycheck       +$3,200.00  Jan 5  • Income              │
│ 📤 Gas Station    -$45.00     Jan 4  • Transportation      │
│ ... (5-8 transactions)                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ > Budget Details                            [Chevron]        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ > Debt & Credit                             [Chevron]        │
└─────────────────────────────────────────────────────────────┘
```

## Notes

- Focus on information density without overwhelming
- Keep most important actions (Add Transaction) above fold
- Bills should be easily scannable
- Secondary details available on demand (collapsible)
- Maintain existing functionality, just reorganized
- Use pnpm for all package operations
- Use Decimal.js for all financial calculations
- Test in both Dark Mode and Dark Pink Theme

## Next Steps

1. Create Task 1: CompactStatsBar component
2. Create Task 2: EnhancedBillsWidget component
3. Create Task 3: CollapsibleSection component
4. Update Task 4: Main dashboard page
5. Iterate based on visual results
6. Mobile testing and adjustments
7. Performance optimization
8. Documentation and build verification
