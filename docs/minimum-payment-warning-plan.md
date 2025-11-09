# Minimum Payment Warning System - Implementation Plan

## Feature Overview
Show users the true cost of only paying minimum payments on their debts by creating a dramatic visual comparison between:
- **Minimum-only scenario**: What happens if they only pay the required minimums
- **Current plan**: Their actual plan with any extra payments they've committed to

This feature aims to motivate users by highlighting the dramatic difference between strategies in terms of both time and money.

## Goals
1. Calculate and display the impact of paying only minimums vs current plan
2. Show shocking statistics to motivate users to pay more than minimums
3. Present information in a clear, visual, and impactful way
4. Integrate seamlessly with existing debt management UI

## Technical Architecture

### 1. Backend Calculations (No new files needed)
**Location**: Existing `lib/debts/payoff-calculator.ts`
- Already has all the calculation logic we need
- `calculatePayoffStrategy()` can be called with `extraPayment: 0` for minimum-only scenario
- `calculatePayoffStrategy()` with user's actual extra payment for current plan
- Compare the two results

### 2. API Endpoint (New)
**Location**: `app/api/debts/minimum-warning/route.ts`
- **Method**: GET
- **Query params**: None (uses authenticated user's debts and settings)
- **Response**:
  ```typescript
  {
    minimumOnlyScenario: {
      totalMonths: number;
      totalInterestPaid: number;
      debtFreeDate: Date;
      monthlyPayment: number; // sum of all minimums
    };
    currentPlanScenario: {
      totalMonths: number;
      totalInterestPaid: number;
      debtFreeDate: Date;
      monthlyPayment: number; // minimums + extra
      extraPayment: number;
    };
    comparison: {
      monthsSaved: number;
      yearsSaved: number; // for easier reading
      interestSaved: number;
      percentageReduction: number; // % less interest with current plan
    };
  }
  ```

### 3. Frontend Component (New)
**Location**: `components/debts/minimum-payment-warning.tsx`
- **Purpose**: Display the dramatic comparison between minimum-only and current plan
- **Design**: Large, impactful card with warning aesthetic
- **Props**:
  ```typescript
  interface MinimumPaymentWarningProps {
    className?: string;
  }
  ```

### 4. Integration Point
**Location**: `app/dashboard/debts/page.tsx`
- Add as a collapsible section (similar to What-If Calculator and Payoff Strategy)
- Position: **Above** the What-If Calculator (most important warning)
- Only show when:
  - User has active debts
  - User has debt settings loaded
  - User is paying more than minimums (extraPayment > 0)
  - If extraPayment = 0, show different message encouraging them to add extra payment

## UI/UX Design

### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  Minimum Payment Warning                          [▼]    │
│ See the true cost of paying only minimum payments           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────┬──────────────────────────────────┐  │
│  │ Minimum Only       │ Your Current Plan                │  │
│  ├────────────────────┼──────────────────────────────────┤  │
│  │ 🐌 156 months      │ ⚡ 48 months                      │  │
│  │ (13 years!)        │ (4 years)                        │  │
│  │                    │                                  │  │
│  │ 💸 $45,234         │ 💰 $12,456                       │  │
│  │ in interest        │ in interest                      │  │
│  │                    │                                  │  │
│  │ $850/month         │ $1,200/month                     │  │
│  │ (minimums only)    │ (+$350 extra)                    │  │
│  └────────────────────┴──────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🎯 By paying $350 extra per month, you will:        │    │
│  │                                                       │    │
│  │ ⏱️  Save 9 YEARS (108 months)                       │    │
│  │ 💵  Save $32,778 in interest (73% less!)            │    │
│  │ 🎉  Be debt-free by March 2029 instead of 2038      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ⚠️ WARNING: If you only pay minimums, you'll pay almost    │
│     4x more in interest and stay in debt for 3x longer!      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Color Scheme (Dark Mode)
- **Warning banner**: Amber/orange tones for urgency
  - Background: `#78350f` (dark amber)
  - Border: `#f59e0b` (amber)
  - Text: `#fef3c7` (light amber)
- **Minimum-only column**: Red/negative tones
  - Background: `#7f1d1d` (dark red)
  - Text highlights: `#fca5a5` (light red)
- **Current plan column**: Green/positive tones
  - Background: `#064e3b` (dark emerald)
  - Text highlights: `#6ee7b7` (light emerald)
- **Savings highlight box**: Blue/info tones
  - Background: `#1e3a8a` (dark blue)
  - Border: `#60a5fa` (blue)
  - Text: `#dbeafe` (light blue)

### Typography & Icons
- Large, bold numbers for dramatic effect
- Use emoji icons for quick visual recognition:
  - 🐌 Slow (minimum only)
  - ⚡ Fast (current plan)
  - 💸 Money burning (minimum only interest)
  - 💰 Money saved (current plan interest)
  - ⏱️ Time saved
  - 💵 Money saved
  - 🎉 Celebration
  - ⚠️ Warning

### Responsive Design
- **Desktop**: Two-column comparison side-by-side
- **Mobile**: Stacked cards, minimum-only on top, current plan below

## Implementation Steps

### Phase 1: Backend & API ✅ (Start here)
1. **Create API endpoint** (`app/api/debts/minimum-warning/route.ts`)
   - Import necessary types from payoff calculator
   - Fetch authenticated user's debts (status = 'active')
   - Fetch user's debt settings (for extra payment amount and method)
   - Calculate minimum-only scenario: `calculatePayoffStrategy(debts, 0, preferredMethod)`
   - Calculate current plan: `calculatePayoffStrategy(debts, extraPayment, preferredMethod)`
   - Compute comparison metrics (savings, percentages, years)
   - Return formatted response
   - Handle edge cases (no debts, no extra payment)

2. **Add helper functions** (if needed)
   - Format large numbers (e.g., "108 months" → "9 years")
   - Calculate percentage savings
   - Format currency with proper decimals

### Phase 2: Frontend Component
3. **Create MinimumPaymentWarning component** (`components/debts/minimum-payment-warning.tsx`)
   - Create client component with useState/useEffect
   - Fetch data from `/api/debts/minimum-warning` on mount
   - Handle loading state
   - Handle empty state (no extra payment)
   - Build two-column comparison layout
   - Add savings highlight section
   - Add warning message at bottom
   - Apply color scheme and styling
   - Make responsive (stack on mobile)

4. **Add visual enhancements**
   - Animated number counters (optional)
   - Progress bars showing time comparison
   - Hover effects on cards
   - Smooth expand/collapse animation

### Phase 3: Integration
5. **Integrate into debts page** (`app/dashboard/debts/page.tsx`)
   - Import MinimumPaymentWarning component
   - Add collapsible section state: `const [showMinWarning, setShowMinWarning] = useState(false)`
   - Add toggle button (similar to What-If and Strategy sections)
   - Position **above** What-If Calculator section
   - Add conditional rendering (only show when active debts exist)
   - Add special message if user has no extra payment set

6. **Handle edge cases**
   - No active debts → Don't show section
   - Extra payment = 0 → Show encouragement message instead of comparison
   - Only 1 debt → Still show comparison (still valuable)
   - Very small extra payment → Still show (even $10/month makes a difference)

### Phase 4: Polish & Testing
7. **Visual testing**
   - Test with various debt scenarios (1 debt, multiple debts, high/low interest)
   - Test with different extra payment amounts ($0, $50, $500, $1000)
   - Test responsive behavior (desktop, tablet, mobile)
   - Verify color contrast for accessibility
   - Test expand/collapse animation

8. **Data validation**
   - Verify calculations match payoff strategy calculations
   - Check edge cases (very long payoff times, very high interest)
   - Ensure numbers format correctly (commas, decimals)
   - Verify dates calculate correctly

9. **Performance**
   - Ensure API responds quickly (< 500ms)
   - Add loading skeleton if needed
   - Consider caching API response briefly

## Success Metrics
- ✅ Shows accurate calculations for minimum-only vs current plan
- ✅ Visual design is impactful and motivating
- ✅ Integrates seamlessly with existing UI
- ✅ Responsive on all screen sizes
- ✅ Loading states handle gracefully
- ✅ Edge cases handled appropriately

## Testing Scenarios

### Test Case 1: Single Credit Card
- Debt: $5,000 @ 18.99% APR, $150 minimum
- Extra payment: $100/month
- Expected: Show dramatic interest savings

### Test Case 2: Multiple Debts (Snowball)
- 3 debts with varying balances and rates
- Extra payment: $200/month
- Expected: Show payoff order and time savings

### Test Case 3: No Extra Payment
- User has debts but extraPayment = 0
- Expected: Show encouragement message, not comparison

### Test Case 4: Large Extra Payment
- Extra payment > total minimum payments
- Expected: Show very fast payoff vs slow minimum-only

## Future Enhancements (Not in this phase)
- Add interactive slider to adjust extra payment and see real-time impact
- Add "Share" button to share motivation with household members
- Add historical tracking ("You've saved $X since starting extra payments")
- Add milestone celebrations ("You've avoided $1,000 in interest so far!")

## Files to Create/Modify

### New Files
1. `app/api/debts/minimum-warning/route.ts` - API endpoint
2. `components/debts/minimum-payment-warning.tsx` - React component

### Modified Files
1. `app/dashboard/debts/page.tsx` - Integration point
2. `docs/features.md` - Mark feature as completed when done

## Estimated Time
- Phase 1 (API): 30-45 minutes
- Phase 2 (Component): 60-90 minutes
- Phase 3 (Integration): 15-30 minutes
- Phase 4 (Polish): 30-45 minutes
- **Total**: 2.5-3.5 hours

## Notes
- This feature is primarily motivational/educational
- Focus on clarity and visual impact
- Use existing payoff calculator (already tested and accurate)
- Keep it simple - no complex interactions needed
- Make the numbers "shocking" to drive behavior change
