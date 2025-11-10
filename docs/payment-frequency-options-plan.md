# Payment Frequency Options - Implementation Plan

## Feature Overview
Expand payment frequency support to include weekly, bi-weekly, monthly, and quarterly payment schedules. This allows users to align debt payments with their pay schedule and see accurate interest calculations for each frequency.

**Current State**: Monthly and bi-weekly payment frequencies are already implemented.

**Goal**: Add weekly and quarterly payment options with correct interest calculations.

## Implementation Steps

### Step 1: Update Database Schema ✅ (Already exists)
**File**: `lib/db/schema.ts`

The `paymentFrequency` field already exists in the `debtSettings` table, but we need to verify it supports all four values.

**Current values**: 'monthly' | 'bi-weekly'
**New values needed**: 'weekly' | 'quarterly'

**Action**: Review schema and add weekly/quarterly to the enum if not present.

---

### Step 2: Update Debt Utilities - Interest Calculations
**File**: `lib/debts/debt-calculations.ts` (or similar)

**Task**: Add interest calculation logic for weekly and quarterly frequencies.

**Interest Calculation Formulas**:

**For Revolving Credit (Credit Cards)**:
- **Weekly**: Daily rate × 7 days per period
- **Bi-weekly**: Daily rate × 14 days per period ✅ (existing)
- **Monthly**: Daily rate × average days per month (30.42) ✅ (existing)
- **Quarterly**: Daily rate × average days per quarter (91.25)

**For Installment Loans (Mortgages, Car Loans)**:
- **Weekly**: Annual rate ÷ 52 payments per year
- **Bi-weekly**: Annual rate ÷ 26 payments per year ✅ (existing)
- **Monthly**: Annual rate ÷ 12 payments per year ✅ (existing)
- **Quarterly**: Annual rate ÷ 4 payments per year

**Additional Calculations Needed**:
- Automatic extra payment effect:
  - Weekly: 52 payments = ~4.33 extra/year compared to monthly
  - Quarterly: Only 4 payments/year (fewer opportunities to reduce principal)
- Minimum payment adjustments based on frequency
- Payment amount conversions for display (weekly to monthly equivalent, etc.)

**Theme Integration**: N/A (utility functions only)

---

### Step 3: Update Payoff Calculator API
**File**: `app/api/debts/payoff-strategy/route.ts`

**Task**: Update the payoff strategy calculator to handle weekly and quarterly frequencies.

**Changes**:
1. Accept `paymentFrequency` query parameter with all four values
2. Calculate correct number of payments per year for each frequency
3. Adjust interest calculations per payment period
4. Update schedule generation to show correct payment dates
5. Ensure monthly equivalent amounts are calculated for comparison

**Example**:
```typescript
const paymentsPerYear = {
  weekly: 52,
  'bi-weekly': 26,
  monthly: 12,
  quarterly: 4
};
```

**Theme Integration**: N/A (API only)

---

### Step 4: Update Debt Settings Component
**File**: `components/debts/debt-payoff-strategy.tsx`

**Task**: Add weekly and quarterly options to the payment frequency selector.

**Changes**:
1. Update frequency options in the UI selector
2. Add helper text explaining each frequency:
   - **Weekly**: 52 payments/year (accelerates payoff, ideal for weekly paychecks)
   - **Bi-weekly**: 26 payments/year (1 extra payment annually)
   - **Monthly**: 12 payments/year (standard)
   - **Quarterly**: 4 payments/year (slower payoff, for irregular income)
3. Update visual distinction (color coding, badges)
4. Show payments per year for selected frequency
5. Display monthly equivalent for non-monthly frequencies

**Theme Integration**:
- Use `bg-card`, `border-border`, `text-foreground` for selector
- Use `bg-accent`, `text-accent-foreground` for selected option
- Use `text-muted-foreground` for helper text
- Use `hover:bg-elevated` for hover states

**Responsive Design**: Ensure selector works on mobile (stack vertically if needed)

---

### Step 5: Update What-If Calculator Component
**File**: `components/debts/what-if-calculator.tsx`

**Task**: Add frequency selection to each scenario in the what-if calculator.

**Changes**:
1. Add frequency dropdown for each scenario
2. Show per-payment amount vs monthly equivalent
3. Update quick templates:
   - "Weekly Payments" template
   - "Quarterly Payment Plan" template
4. Recalculate comparisons when frequency changes
5. Show annualized totals for clarity

**Theme Integration**:
- Consistent with existing dropdown styling
- Use semantic color tokens throughout
- Maintain hover states and focus indicators

---

### Step 6: Update Debt Settings API
**File**: `app/api/debts/settings/route.ts`

**Task**: Ensure PUT endpoint accepts and validates all four payment frequencies.

**Changes**:
1. Update validation to accept 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly'
2. Add validation for reasonable payment amounts at each frequency
3. Return appropriate error messages for invalid frequencies

**Theme Integration**: N/A (API only)

---

### Step 7: Update Adherence and Streak Components
**Files**:
- `components/debts/payment-adherence-card.tsx`
- `components/debts/payment-streak-widget.tsx`

**Task**: Adjust adherence calculations and streak tracking for different payment frequencies.

**Changes**:
1. **Payment Adherence**:
   - Calculate expected payments based on frequency (weekly = 4.33/month, quarterly = 0.33/month)
   - Adjust scoring weights for different frequencies
   - Show frequency-appropriate labels (e.g., "Last 12 weeks" for weekly)

2. **Payment Streak**:
   - Define "qualifying payment" threshold per frequency
   - Adjust milestone counts (weekly might reach 52 faster, quarterly takes longer)
   - Update streak labels to match frequency

**Theme Integration**:
- Maintain existing theme variable usage
- Consistent color coding across frequencies

---

### Step 8: Update Debt Reduction Chart
**File**: `components/debts/debt-reduction-chart.tsx`

**Task**: Ensure chart accurately reflects different payment frequencies.

**Changes**:
1. Update data point generation based on payment frequency
2. Show correct time intervals on X-axis (weeks, months, quarters)
3. Adjust projection calculations for frequency
4. Update tooltip labels to show frequency-appropriate information

**Theme Integration**: Already using CSS variables, no changes needed

---

### Step 9: Update Amortization Schedule
**File**: `components/debts/amortization-schedule-view.tsx`

**Task**: Display amortization schedules for weekly and quarterly payments.

**Changes**:
1. Update table headers to show frequency-appropriate labels
2. Adjust row generation for number of payments
3. Update date calculations (weekly = 7 days apart, quarterly = ~91 days)
4. Show period numbers clearly (e.g., "Week 1", "Quarter 1")
5. Maintain performance with virtual scrolling for weekly (could be 1,000+ rows)

**Theme Integration**: Already using CSS variables, maintain consistency

---

### Step 10: Add User Education and Help Text
**Files**: Various components with frequency selectors

**Task**: Add helpful information explaining the impact of each frequency.

**Content to Add**:
1. **Weekly Payments**:
   - "52 payments per year = ~4.33 extra payments annually"
   - "Fastest debt reduction, ideal for weekly paychecks"
   - "Can reduce total interest by 40-60% vs monthly"

2. **Quarterly Payments**:
   - "Only 4 payments per year"
   - "Interest compounds more between payments"
   - "Best for business owners or irregular income"
   - "Will take longer to pay off debt"

3. Comparison tooltips showing impact of switching frequencies
4. Warning indicators for suboptimal choices (e.g., quarterly on high-interest debt)

**Theme Integration**:
- Use `text-muted-foreground` for help text
- Use `bg-[var(--color-warning)]` for warning indicators
- Use `bg-[var(--color-success)]` for positive recommendations

---

### Step 11: Testing and Validation
**Task**: Comprehensive testing of all frequency options.

**Test Cases**:
1. **Interest Calculations**:
   - Verify revolving credit interest for weekly/quarterly
   - Verify installment loan interest for weekly/quarterly
   - Compare calculations against manual Excel verification

2. **Edge Cases**:
   - Zero interest rate with weekly/quarterly
   - Very small payment amounts (< minimum payment)
   - Very large debts with weekly payments (performance)
   - Switching frequencies mid-payoff

3. **UI/UX**:
   - Frequency selector on all relevant pages
   - Labels update correctly
   - Amounts display properly (per-payment and monthly equivalent)
   - Charts render correctly for all frequencies

4. **API**:
   - Settings save correctly
   - Payoff calculations accurate
   - Adherence tracking works for all frequencies

**Theme Integration**: Verify all components use CSS variables in all states

---

### Step 12: Documentation Updates
**Files**:
- `docs/features.md`
- `.claude/claude.md`

**Task**: Document the completed feature.

**Content**:
- Mark Feature #10 as completed
- Document all four frequency options
- Include interest calculation formulas
- Note performance optimizations for weekly schedules
- Add to "Recent Updates" section in claude.md

---

## Implementation Priority
1. ✅ Step 1: Database schema verification (should already support it)
2. 🔵 Step 2: Interest calculation utilities (CRITICAL - foundation)
3. 🔵 Step 3: Update payoff calculator API (CRITICAL - core functionality)
4. 🔵 Step 4: Update debt settings component (HIGH - user-facing)
5. 🔵 Step 5: Update what-if calculator (HIGH - user-facing)
6. 🟡 Step 6: Debt settings API validation (MEDIUM)
7. 🟡 Step 7: Adherence and streak updates (MEDIUM)
8. 🟡 Step 8: Debt reduction chart updates (MEDIUM)
9. 🟡 Step 9: Amortization schedule updates (MEDIUM)
10. 🟢 Step 10: User education content (LOW - enhancement)
11. 🔵 Step 11: Testing (CRITICAL - before release)
12. 🟢 Step 12: Documentation (LOW - final step)

## Design Considerations

### Visual Design
- Use radio buttons or segmented control for frequency selection
- Show frequency badge/chip next to payment amounts
- Display conversion helper: "Weekly $50 = $217/month equivalent"
- Color-code frequencies: Weekly (green - fastest), Monthly (blue - standard), Quarterly (amber - slower)

### Performance
- Weekly schedules can generate 1,000+ rows - ensure virtual scrolling works
- Cache calculations to avoid re-computing on every render
- Lazy load weekly amortization schedules

### User Experience
- Default to monthly (most common)
- Show recommended frequency based on income sources if available
- Warn when quarterly is selected for high-interest debt
- Celebrate when weekly accelerates payoff significantly

### Accessibility
- Ensure frequency selectors are keyboard navigable
- Add ARIA labels for screen readers
- Provide clear labels for all frequencies
- Use semantic HTML for radio/select controls

## Success Criteria
✅ All four payment frequencies (weekly, bi-weekly, monthly, quarterly) selectable
✅ Interest calculations accurate for each frequency
✅ Payoff projections correct for all frequencies
✅ Charts and schedules display correctly
✅ Settings persist across sessions
✅ No performance degradation with weekly schedules (1000+ rows)
✅ All components use theme CSS variables
✅ Responsive design works on all screen sizes
✅ Help text explains impact of each frequency
✅ Existing bi-weekly and monthly functionality unchanged

## Estimated Complexity
**Medium-High** - Requires careful interest calculation updates, multiple component changes, and thorough testing, but builds on existing bi-weekly implementation.

## Files to Modify
1. `lib/db/schema.ts` (verify enum)
2. `lib/debts/debt-calculations.ts` or similar utility file
3. `app/api/debts/payoff-strategy/route.ts`
4. `app/api/debts/settings/route.ts`
5. `components/debts/debt-payoff-strategy.tsx`
6. `components/debts/what-if-calculator.tsx`
7. `components/debts/payment-adherence-card.tsx`
8. `components/debts/payment-streak-widget.tsx`
9. `components/debts/debt-reduction-chart.tsx`
10. `components/debts/amortization-schedule-view.tsx`
11. `docs/features.md`
12. `.claude/claude.md`

## New Files to Create
None - all changes are modifications to existing files.
