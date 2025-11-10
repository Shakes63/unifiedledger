# Feature #12: Collapsible Debt Cards - Implementation Plan

## Overview
Enhance the debt tracking interface with collapsible sections to keep the UI clean and organized when users have multiple debts. This feature adds expand/collapse functionality for the entire debt card and includes accordion sections for payment history and amortization schedules.

## Current State Analysis

### Existing Components
- ✅ `DebtPayoffTracker` - Main debt card component
- ✅ Already has some collapsible sections (milestones toggle)
- ✅ Payment recording interface
- ✅ Progress bar and stats display
- ✅ `/api/debts/[id]/payments` - API endpoint for payment history
- ✅ `AmortizationScheduleView` - Comprehensive amortization component (exists but not integrated per-debt)

### Current UI Structure
```tsx
<Card>
  <Header (name, creditor, edit/delete buttons)>
  <Progress Bar>
  <Stats (paid off, min payment, days left)>
  <Interest Rate>
  <Milestones (collapsible)>
  <Record Payment (collapsible form)>
</Card>
```

### What's Missing
- ❌ Ability to collapse the entire debt card to just the header
- ❌ Payment history accordion section
- ❌ Per-debt amortization schedule accordion
- ❌ Smart defaults (keep high-priority debts expanded)
- ❌ Persist expand/collapse state

## Feature Requirements

### 1. Collapsible Main Card Body
- Click header to expand/collapse entire debt card
- Collapsed state shows only: debt name, creditor, balance, and quick stats
- Expanded state shows all details as currently displayed
- Smooth animations using CSS transitions
- Chevron icon indicating expand/collapse state

### 2. Payment History Accordion
- Shows all payments made on this debt
- Sortable by date (newest first by default)
- Display: date, amount, running balance, principal/interest split (if available)
- Empty state if no payments yet
- Pagination or virtual scrolling for long histories
- Visual indicators for large payments or milestones

### 3. Amortization Schedule Accordion (Per-Debt)
- Shows projected payoff schedule for this specific debt
- Uses existing `AmortizationScheduleView` component but for single debt
- Includes all three tabs: Overview, Full Schedule, Charts
- Only shown for debts with interest rates
- Calculate based on current balance and minimum payment

### 4. Expand/Collapse State Management
- Default: First 3 debts expanded, rest collapsed (if 4+ debts)
- localStorage persistence (per user preference)
- URL parameter support for deep linking to specific debt
- "Expand All" / "Collapse All" buttons in debts page header

### 5. Visual Polish
- Smooth height transitions (CSS max-height trick or Framer Motion)
- Hover effects on clickable header
- Consistent chevron icons (ChevronDown/ChevronUp from lucide-react)
- Loading states for payment history and amortization data
- Empty states with helpful messages

## Design Specifications

### Color Scheme (Using Theme Variables)
- **Header Hover**: `hover:bg-elevated`
- **Borders**: `border-border`
- **Backgrounds**: `bg-card`, `bg-elevated`
- **Text**: `text-foreground`, `text-muted-foreground`
- **Accents**: `bg-accent`, `text-accent`
- **Icons**: `text-muted-foreground` → `hover:text-foreground`

### Layout Mockups

#### Collapsed State
```
┌─────────────────────────────────────────────────────────┐
│  🔴 Chase Freedom                        ▼  [Edit] [Del]│
│  Chase Bank                                              │
│  $2,250 / $5,000 • 45% paid • 12 months left            │
└─────────────────────────────────────────────────────────┘
```

#### Expanded State with New Accordions
```
┌─────────────────────────────────────────────────────────┐
│  🔴 Chase Freedom                        ▲  [Edit] [Del]│
│  Chase Bank                                              │
│                                                          │
│  $2,250 remaining of $5,000                         55% │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░           │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Paid Off │  │ Min Pay  │  │ Days Left│            │
│  │  $2,750  │  │   $50    │  │   365    │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                          │
│  Interest Rate: 18.99%                                   │
│                                                          │
│  ▼ Payment History (23 payments)                        │
│  ┌────────────────────────────────────────────────┐    │
│  │ Nov 9, 2025      $100.00      Balance: $2,250  │    │
│  │ Oct 9, 2025      $100.00      Balance: $2,350  │    │
│  │ Sep 9, 2025      $100.00      Balance: $2,450  │    │
│  │ ... (show first 5, then "Show All")            │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ▼ Amortization Schedule                                │
│  ┌────────────────────────────────────────────────┐    │
│  │ [Overview] [Full Schedule] [Charts]            │    │
│  │                                                  │    │
│  │ Payoff Timeline: 24 months                      │    │
│  │ Total Interest: $450.23                         │    │
│  │ Debt-Free Date: Nov 2027                        │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ▼ Milestones                                           │
│  [Existing milestones UI]                               │
│                                                          │
│  [Record Payment Button]                                │
└─────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Update DebtPayoffTracker State Management
**File**: `components/debts/debt-payoff-tracker.tsx`

**Add State Variables**:
```typescript
const [isExpanded, setIsExpanded] = useState(true); // Main card expansion
const [showPaymentHistory, setShowPaymentHistory] = useState(false);
const [showAmortization, setShowAmortization] = useState(false);
const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
const [loadingHistory, setLoadingHistory] = useState(false);
```

**Props Enhancement**:
```typescript
interface DebtTrackerProps {
  debt: { /* existing fields */ };
  milestones?: Milestone[];
  payments?: any[]; // Existing but may not be loaded
  onEdit?: (debt: any) => void;
  onDelete?: (debtId: string) => void;
  onPayment?: (debtId: string, amount: number) => void;
  defaultExpanded?: boolean; // NEW: Control initial expansion
  showCompact?: boolean; // NEW: Show ultra-compact mode
}
```

### Step 2: Create PaymentHistory Component
**File**: `components/debts/payment-history-list.tsx` (NEW)

**Purpose**: Display payment history in a clean, scannable list

**Features**:
- Fetch payment data from API on mount
- Display in reverse chronological order (newest first)
- Show: date, amount, running balance, notes
- Color-code payments by size (large payments highlighted)
- Show principal/interest split if available
- Empty state: "No payments recorded yet"
- Loading skeleton
- "Show All" toggle if many payments (collapse to 5 initially)

**Layout**:
```tsx
<div className="space-y-2">
  {payments.map(payment => (
    <div className="flex items-center justify-between p-3 bg-elevated rounded-lg">
      <div>
        <div className="text-sm font-semibold text-foreground">
          ${payment.amount.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(payment.paymentDate)}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm text-muted-foreground">
          Balance: ${payment.runningBalance.toLocaleString()}
        </div>
        {payment.principalAmount && (
          <div className="text-xs text-muted-foreground">
            ${payment.principalAmount} principal • ${payment.interestAmount} interest
          </div>
        )}
      </div>
    </div>
  ))}
</div>
```

### Step 3: Create DebtAmortizationSection Component
**File**: `components/debts/debt-amortization-section.tsx` (NEW)

**Purpose**: Wrapper around AmortizationScheduleView for single debt

**Features**:
- Generate payoff strategy for single debt only
- Pass to existing `AmortizationScheduleView` component
- Handle loading and error states
- Only show if debt has interest rate > 0
- Calculate based on current debt settings (extra payments, frequency)

**Implementation**:
```typescript
interface DebtAmortizationSectionProps {
  debt: Debt;
  className?: string;
}

export function DebtAmortizationSection({ debt, className }: Props) {
  const [strategy, setStrategy] = useState<PayoffStrategyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch payoff strategy for this debt only
    // Use /api/debts/payoff-strategy with single debt
  }, [debt.id]);

  if (debt.interestRate === 0) {
    return <div className="text-sm text-muted-foreground p-3">
      No interest on this debt
    </div>;
  }

  return strategy && <AmortizationScheduleView strategy={strategy} />;
}
```

### Step 4: Update DebtPayoffTracker with Collapsible Sections
**File**: `components/debts/debt-payoff-tracker.tsx`

**Changes**:

1. **Make Header Clickable**:
```tsx
<div
  onClick={() => setIsExpanded(!isExpanded)}
  className="cursor-pointer hover:bg-elevated/50 transition-colors rounded-lg -m-2 p-2"
>
  <div className="flex items-start justify-between">
    {/* Existing header content */}
    <ChevronDown
      className={`w-5 h-5 text-muted-foreground transition-transform ${
        isExpanded ? 'rotate-180' : ''
      }`}
    />
  </div>
</div>
```

2. **Add Collapsed Summary View**:
```tsx
{!isExpanded && (
  <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
    <span>${debt.remainingBalance.toLocaleString()} / ${debt.originalAmount.toLocaleString()}</span>
    <span>{progressPercent.toFixed(0)}% paid</span>
    {daysLeft && <span>{daysLeft} days left</span>}
  </div>
)}
```

3. **Wrap Expandable Content**:
```tsx
{isExpanded && (
  <div className="space-y-4">
    {/* All existing content */}

    {/* NEW: Payment History Section */}
    <div className="border-t border-border pt-3">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowPaymentHistory(!showPaymentHistory);
        }}
        className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          {showPaymentHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Payment History
        </span>
        {!loadingHistory && paymentHistory.length > 0 && (
          <span className="text-xs">({paymentHistory.length} payments)</span>
        )}
      </button>
      {showPaymentHistory && (
        <div className="mt-3">
          <PaymentHistoryList debtId={debt.id} />
        </div>
      )}
    </div>

    {/* NEW: Amortization Schedule Section */}
    {debt.interestRate > 0 && (
      <div className="border-t border-border pt-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAmortization(!showAmortization);
          }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAmortization ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Amortization Schedule
        </button>
        {showAmortization && (
          <div className="mt-3">
            <DebtAmortizationSection debt={debt} />
          </div>
        )}
      </div>
    )}
  </div>
)}
```

### Step 5: Add Expand/Collapse All Controls
**File**: `app/dashboard/debts/page.tsx`

**Add Controls Above Debt List**:
```tsx
{debts.length > 1 && (
  <div className="flex gap-2 mb-4">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setAllExpanded(true)}
      className="text-sm"
    >
      Expand All
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setAllExpanded(false)}
      className="text-sm"
    >
      Collapse All
    </Button>
  </div>
)}
```

**Pass to DebtPayoffTracker**:
```tsx
<DebtPayoffTracker
  key={debt.id}
  debt={debt}
  defaultExpanded={allExpanded ?? (index < 3)} // First 3 expanded by default
  // ... other props
/>
```

### Step 6: Add localStorage Persistence (Optional Enhancement)
**File**: `components/debts/debt-payoff-tracker.tsx`

**Persist Expansion State**:
```typescript
// On mount, check localStorage
useEffect(() => {
  const saved = localStorage.getItem(`debt-${debt.id}-expanded`);
  if (saved !== null) {
    setIsExpanded(saved === 'true');
  }
}, [debt.id]);

// On change, save to localStorage
const toggleExpanded = () => {
  const newState = !isExpanded;
  setIsExpanded(newState);
  localStorage.setItem(`debt-${debt.id}-expanded`, newState.toString());
};
```

### Step 7: Add Smooth Animations
**File**: `components/debts/debt-payoff-tracker.tsx`

**CSS Approach** (simple):
```tsx
<div
  className="overflow-hidden transition-all duration-300 ease-in-out"
  style={{ maxHeight: isExpanded ? '2000px' : '0' }}
>
  {/* Expandable content */}
</div>
```

**OR Framer Motion Approach** (smooth):
```tsx
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {isExpanded && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Expandable content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Step 8: Create Utility Hook for Debt Expansion
**File**: `lib/hooks/use-debt-expansion.ts` (NEW)

**Purpose**: Centralize expansion state logic

```typescript
export function useDebtExpansion(debtId: string, defaultExpanded = true) {
  const [isExpanded, setIsExpanded] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem(`debt-${debtId}-expanded`);
    return saved !== null ? saved === 'true' : defaultExpanded;
  });

  const toggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem(`debt-${debtId}-expanded`, newState.toString());
  };

  return { isExpanded, toggle, setIsExpanded };
}
```

### Step 9: Testing & Polish

**Test Scenarios**:
1. ✅ Single debt - all sections work
2. ✅ Multiple debts - expand/collapse independently
3. ✅ "Expand All" / "Collapse All" buttons
4. ✅ Payment history loads correctly
5. ✅ Amortization schedule displays
6. ✅ Animations are smooth
7. ✅ localStorage persistence works
8. ✅ Empty states display correctly
9. ✅ Mobile responsive
10. ✅ Click events don't conflict (header vs buttons)
11. ✅ Loading states display
12. ✅ Error handling
13. ✅ Accessibility (keyboard navigation)
14. ✅ Long payment histories (50+ payments)
15. ✅ Debts with no interest (amortization hidden)

**Edge Cases**:
- User has 0 debts
- User has 1 debt (no expand/collapse all)
- User has 20+ debts (performance)
- Payment history is empty
- Very long debt names (truncation)
- Mobile screen widths
- Click header while sections are open

### Step 10: Update Documentation
**File**: `docs/features.md`

**Update Feature #12**:
```markdown
12. ✅ Collapsible Debt Cards (COMPLETED)

  When you have many debts:
  - Expand/collapse individual debts
  - "Show payment history" accordion
  - "Show amortization schedule" accordion
  - Keeps UI clean but data accessible

  Implementation complete with:
  - **Collapsible Main Card**: Click header to expand/collapse entire debt card
    - Collapsed shows: name, creditor, balance, quick stats
    - Expanded shows: full details, payment form, milestones
    - Smooth animations with CSS transitions
    - Chevron icon indicating state
  - **PaymentHistoryList Component**: Displays all payments for a debt
    - Reverse chronological order (newest first)
    - Shows: date, amount, balance, principal/interest split
    - Color-coded large payments
    - Empty state and loading skeleton
    - "Show All" toggle for long histories
  - **DebtAmortizationSection Component**: Per-debt amortization schedule
    - Integrates existing AmortizationScheduleView
    - Three tabs: Overview, Full Schedule, Charts
    - Only shown for debts with interest
    - Loading and error states
  - **Expand/Collapse All Controls**: Debts page header buttons
    - "Expand All" / "Collapse All" buttons
    - Smart defaults (first 3 debts expanded if 4+ total)
  - **localStorage Persistence**: Remembers user preferences per debt
  - **Theme Integration**: All colors use CSS variables
  - **Responsive Design**: Works on mobile, tablet, desktop
  - **Accessibility**: Keyboard navigation, ARIA labels
  - **Performance**: Efficient rendering for many debts
```

## File Structure Summary

```
components/debts/
├── debt-payoff-tracker.tsx              (MODIFIED - add collapsible sections)
├── payment-history-list.tsx             (NEW - payment history display)
└── debt-amortization-section.tsx        (NEW - per-debt amortization)

app/dashboard/debts/
└── page.tsx                             (MODIFIED - add expand/collapse all)

lib/hooks/
└── use-debt-expansion.ts                (NEW - expansion state hook)

docs/
└── features.md                          (UPDATE - mark complete)
```

## Technical Considerations

### Performance
- Lazy load payment history (only fetch when expanded)
- Lazy load amortization (only calculate when expanded)
- Virtual scrolling for very long payment histories (100+ items)
- Memoize expensive calculations
- Avoid re-rendering collapsed cards

### State Management
- Local component state for expansion (simple, fast)
- localStorage for persistence (optional)
- Prop drilling for "expand all" functionality
- Consider Context API if state becomes complex

### Animations
- CSS transitions for simple expand/collapse
- Consider Framer Motion for smoother animations
- Test on low-end devices
- Reduce motion for accessibility preferences

### Accessibility
- Clickable header needs proper ARIA attributes
- Keyboard navigation (Enter/Space to toggle)
- Focus management when expanding/collapsing
- Screen reader announcements for state changes
- Color contrast for all states

### Mobile Considerations
- Touch-friendly header (larger tap target)
- Swipe gestures? (optional enhancement)
- Stack payment history items on narrow screens
- Reduce padding in compact mode
- Test on iOS and Android

### Error Handling
- API failures for payment history
- Network timeouts
- Invalid debt data
- Empty states
- Loading states

## Estimated Effort
- **Step 1**: 0.5 hours - State management setup
- **Step 2**: 1.5 hours - PaymentHistoryList component
- **Step 3**: 1 hour - DebtAmortizationSection component
- **Step 4**: 2 hours - Update DebtPayoffTracker with collapsible UI
- **Step 5**: 0.5 hours - Expand/collapse all controls
- **Step 6**: 0.5 hours - localStorage persistence
- **Step 7**: 0.5 hours - Smooth animations
- **Step 8**: 0.5 hours - useDebtExpansion hook
- **Step 9**: 1.5 hours - Testing and polish
- **Step 10**: 0.25 hours - Documentation

**Total**: ~8.75 hours

## Success Criteria
- ✅ Users can collapse/expand individual debt cards
- ✅ Payment history displays correctly with all details
- ✅ Amortization schedule shows for debts with interest
- ✅ "Expand All" / "Collapse All" buttons work
- ✅ Smooth animations on all interactions
- ✅ localStorage persists user preferences
- ✅ Mobile responsive and touch-friendly
- ✅ No performance degradation with 10+ debts
- ✅ Accessible via keyboard and screen readers
- ✅ Theme variables used consistently
- ✅ Empty states handled gracefully
- ✅ Loading states display properly

## Future Enhancements (Not in Scope)
- Swipe gestures on mobile
- Drag-to-reorder debts
- Custom collapse/expand animations per debt
- "Focus mode" showing only one debt at a time
- Keyboard shortcuts (e.g., Cmd+1-9 to toggle debts)
- Export payment history to CSV
- Print-friendly collapsed view
- Bulk operations on collapsed debts

## Dependencies
- ✅ lucide-react (ChevronDown, ChevronUp icons)
- ✅ Existing AmortizationScheduleView component
- ✅ `/api/debts/[id]/payments` endpoint
- ✅ Theme system
- ✅ UI components (Button, Card, etc.)
- ⚠️ Optional: framer-motion for smooth animations

## Risk Assessment
- **Low Risk**: Straightforward UI enhancement
- **Medium Complexity**: Multiple collapsible sections with state management
- **High Value**: Significantly improves UX for users with many debts
- **Good Foundation**: Existing components and patterns to follow
