# Payment Adherence Tracking - Implementation Plan

## Overview
Track actual debt payments vs recommended strategy, showing users if they're ahead/behind schedule with motivational streak tracking and recalculated projections based on actual payment history.

## Current System Analysis

### Existing Components
- ✅ `debt_payments` table: Tracks all debt payments (amount, principal, interest, date)
- ✅ Debt settings: Stores user's preferred method (snowball/avalanche) and extra payment amount
- ✅ Payoff calculator: Generates expected payment schedules
- ✅ Debt countdown widget: Shows progress toward debt-free goal
- ✅ Debt stats API: Provides debt overview

### Available Data
- **Actual Payments**: Complete history in `debt_payments` table
- **Expected Schedule**: Can be generated from payoff calculator
- **User Settings**: Preferred method, extra payment amount, frequency
- **Debt Details**: Balance, interest rate, minimum payment

## Feature Requirements

### 1. Payment Adherence Calculator
Compare actual vs expected payments:
```
For each month:
  Expected Payment = Minimum + (Extra / Debt Count) based on strategy
  Actual Payment = Sum of all payments made that month
  Adherence = (Actual / Expected) × 100%
```

**Status Levels:**
- **On Track**: 95-105% of expected (green)
- **Ahead of Schedule**: >105% of expected (blue/emerald)
- **Behind Schedule**: <95% of expected (amber)
- **Significantly Behind**: <80% of expected (red)

### 2. Payment Streak Tracking
Motivational feature:
- Track consecutive months with on-time/above-minimum payments
- Show current streak and longest streak
- Celebrate milestones (3, 6, 12, 24, 36 months)
- Reset conditions: missed payment or payment < minimum

### 3. Projection Recalculation
Use actual payment history to update projections:
- Start from current balance
- Calculate based on actual average payment (last 3-6 months)
- Compare to original projection
- Show "ahead by X months" or "behind by X months"

### 4. Payment History Visualization
Monthly calendar/timeline:
- Each month shows actual vs expected
- Color-coded indicators
- Hover/click for details
- Last 12 months view

## Implementation Steps

### Phase 1: Backend - Payment Adherence API ✅
**File:** `app/api/debts/adherence/route.ts`

**Functionality:**
- GET endpoint returning adherence analysis
- Fetch user's debt settings (method, extra payment, frequency)
- Calculate expected payment schedule using payoff calculator
- Fetch actual payments from debt_payments table
- Group payments by month
- Compare actual vs expected for each month
- Calculate adherence percentage
- Determine status (on track, ahead, behind)
- Calculate overall adherence score
- Return last 12 months of data

**Response Structure:**
```typescript
{
  overallStatus: 'on_track' | 'ahead' | 'behind' | 'significantly_behind';
  overallAdherence: number; // Percentage (100 = perfect)
  monthsTracked: number;
  monthsOnTrack: number;
  monthsAhead: number;
  monthsBehind: number;
  averageAdherence: number;
  projectionAdjustment: {
    monthsAheadOrBehind: number; // Positive = ahead, negative = behind
    originalDebtFreeDate: string;
    adjustedDebtFreeDate: string;
    adjustedTotalInterest: number;
    savingsFromBeingAhead?: number; // If ahead
  };
  monthlyData: Array<{
    month: string; // "2025-01"
    monthLabel: string; // "Jan 2025"
    expectedPayment: number;
    actualPayment: number;
    adherence: number; // Percentage
    status: 'on_track' | 'ahead' | 'behind' | 'significantly_behind';
    difference: number; // actual - expected
  }>;
}
```

**Logic:**
1. Get user's debt settings and active debts
2. Calculate expected schedule for last 12 months
3. Fetch actual payments grouped by month
4. For each month, compare actual vs expected
5. Calculate adherence percentage per month
6. Determine overall status based on recent trends (last 3 months weighted more)
7. Recalculate debt-free projection using actual payment average

---

### Phase 2: Backend - Payment Streak API ✅
**File:** `app/api/debts/streak/route.ts`

**Functionality:**
- GET endpoint returning streak information
- Fetch all debt payments ordered by date
- Calculate current streak (consecutive months with qualifying payments)
- Calculate longest streak ever
- Identify next milestone
- Return streak achievements

**Response Structure:**
```typescript
{
  currentStreak: number; // Months
  longestStreak: number; // Months
  isActive: boolean; // True if streak is current
  lastPaymentDate: string;
  nextPaymentDue: string;
  nextMilestone: {
    months: number; // e.g., 12
    label: string; // e.g., "1 Year Streak"
    remaining: number; // Months until milestone
  };
  achievements: Array<{
    milestone: number;
    achievedAt: string;
    label: string;
    icon: string; // emoji
  }>;
  streakHistory: Array<{
    startDate: string;
    endDate: string;
    months: number;
  }>;
}
```

**Qualifying Payment:**
- Payment amount >= debt's minimum payment
- Made within the month (not late)
- Can be one payment or sum of multiple payments

**Streak Milestones:**
- 3 months: "Quarter Streak" 🔥
- 6 months: "Half Year Streak" 💪
- 12 months: "1 Year Streak" 🏆
- 24 months: "2 Year Streak" 🥇
- 36 months: "3 Year Streak" 💎

---

### Phase 3: Backend - Recalculated Projection API ✅
**File:** `app/api/debts/projection-update/route.ts`

**Functionality:**
- GET endpoint with query param for historical months to analyze (default: 3)
- Fetch actual payments for last X months
- Calculate average actual payment
- Use average to recalculate payoff strategy
- Compare to original projection (using current settings)
- Return before/after comparison

**Response Structure:**
```typescript
{
  analysisMonths: number; // How many months analyzed
  actualAveragePayment: number; // Average of actual payments
  expectedAveragePayment: number; // From current settings

  originalProjection: {
    monthsToDebtFree: number;
    debtFreeDate: string;
    totalInterest: number;
  };

  adjustedProjection: {
    monthsToDebtFree: number;
    debtFreeDate: string;
    totalInterest: number;
  };

  impact: {
    monthsSavedOrLost: number; // Positive = ahead, negative = behind
    interestSavedOrLost: number;
    percentageFaster: number; // Can be negative
    status: 'ahead' | 'on_track' | 'behind';
    message: string; // "You're 3 months ahead of schedule!"
  };

  recommendation: {
    shouldIncreaseExtra: boolean;
    suggestedExtraPayment?: number;
    message: string;
  };
}
```

---

### Phase 4: Frontend - Payment Adherence Card Component ✅
**File:** `components/debts/payment-adherence-card.tsx`

**Features:**
- Collapsible section on debts page
- Shows overall adherence status
- Color-coded status indicator
- "X of 12 months on track"
- Link to detailed view
- Mini bar chart showing last 6 months

**Visual Design:**
- Card with border color based on status
- Large adherence percentage (e.g., "102%")
- Status badge (On Track, Ahead, Behind)
- Mini visualization (sparkline or bars)
- "View Details" button

**States:**
- Loading
- No payment history (encourage first payment)
- Active tracking (show data)
- Error handling

---

### Phase 5: Frontend - Payment History Chart ✅
**File:** `components/debts/payment-history-chart.tsx`

**Features:**
- Bar chart comparing expected vs actual payments
- X-axis: Months (last 12)
- Y-axis: Payment amount
- Two bars per month: Expected (gray) and Actual (color-coded)
- Color coding:
  - Green: On track (95-105%)
  - Emerald: Ahead (>105%)
  - Amber: Behind (80-95%)
  - Red: Significantly behind (<80%)
- Hover tooltip with details
- Grid lines for easy reading

**Library:** Recharts (already in project)

**Component Props:**
```typescript
interface PaymentHistoryChartProps {
  monthlyData: MonthlyAdherenceData[];
  height?: number;
}
```

---

### Phase 6: Frontend - Payment Streak Widget ✅
**File:** `components/debts/payment-streak-widget.tsx`

**Features:**
- Shows current streak prominently
- Flame icon 🔥 with streak number
- Progress bar to next milestone
- "Longest streak: X months" subtext
- Achievement badges for completed milestones
- Motivational message

**Visual Design:**
- Gradient background based on streak length
- Animated flame icon
- Progress ring or bar
- Trophy icons for achievements
- Celebration animations for new milestones

**States:**
- No streak: "Start your payment streak today!"
- Active streak: Show current count
- Broken streak: "Streak ended. Start fresh!"
- Milestone reached: Celebration UI

---

### Phase 7: Frontend - Detailed Adherence View ✅
**File:** `app/dashboard/debts/adherence/page.tsx`

**Features:**
- Full page view of payment adherence
- Header with overall stats
- Payment history chart (12 months)
- Month-by-month breakdown table
- Payment streak widget
- Projection comparison (original vs adjusted)
- Recommendations section
- "Export Report" button

**Layout:**
```
┌─────────────────────────────────────┐
│ Overall Adherence: 102% ✅          │
│ 10/12 months on track               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Payment History Chart (12 months)   │
│ [Bar chart here]                    │
└─────────────────────────────────────┘

┌──────────────┬──────────────────────┐
│ Streak: 🔥 8 │ Projection Update    │
│ Longest: 10  │ 2 months ahead!      │
└──────────────┴──────────────────────┘

┌─────────────────────────────────────┐
│ Monthly Breakdown Table             │
│ Month | Expected | Actual | Status  │
└─────────────────────────────────────┘
```

---

### Phase 8: Integration - Debts Page Update ✅
**File:** `app/dashboard/debts/page.tsx`

**Changes:**
- Add Payment Adherence Card after Payoff Strategy
- Collapsible section with summary
- Expand to show mini chart
- "View Full Report" link to detailed page

**Order:**
1. Debt-Free Countdown
2. Debt Stats
3. Minimum Payment Warning
4. Payment Adherence ← NEW
5. What-If Calculator
6. Payoff Strategy
7. Debts List

---

### Phase 9: Integration - Dashboard Enhancement ✅
**File:** `app/dashboard/page.tsx`

**Option 1: Add to Debt Countdown Card**
- Show mini streak indicator
- "🔥 5 month streak" badge

**Option 2: Separate Mini Widget**
- Small payment adherence indicator
- "102% adherence this month"
- Click to view details

**Decision:** Add mini streak to Debt Countdown Card (less clutter)

---

### Phase 10: Edge Cases & Polish ✅

**Handle Edge Cases:**

1. **New User (No Payment History)**
   - Show: "Start tracking your payments!"
   - Explain how adherence works
   - Encourage first payment
   - No adherence score yet

2. **Less Than 3 Months Data**
   - Show available data
   - Note: "Limited history, tracking X months"
   - Use available data without projections

3. **Irregular Payment Schedule**
   - Handle multiple payments per month
   - Handle large lump sum payments
   - Don't penalize for paying extra early

4. **Changed Strategy Mid-Way**
   - Detect when user changed settings
   - Recalculate from that point forward
   - Note the change in history

5. **Missed Payments**
   - Show gap in streak
   - Don't over-penalize (life happens)
   - Encourage getting back on track

6. **Paid Off Debt**
   - Celebrate achievement!
   - Archive adherence history
   - Show "100% Complete" badge

**Polish:**
- Smooth animations for status changes
- Celebration confetti for streaks
- Helpful tooltips
- Empty states with CTAs
- Loading skeletons
- Error messages with recovery suggestions

---

### Phase 11: Testing & Documentation ✅

**API Tests:**
- Adherence calculations
- Streak tracking logic
- Projection updates
- Edge cases (no data, irregular payments)

**Component Tests:**
- Chart rendering
- Streak widget updates
- Status color coding
- Responsive design

**Integration Tests:**
- Full adherence flow
- Streak milestones
- Dashboard updates

**Documentation:**
- Update CLAUDE.md with new APIs
- Add feature to features.md
- Document calculation formulas
- Add usage examples

---

## Database Changes

### None Required! ✅
All necessary data already exists:
- `debt_payments` - Complete payment history
- `debt_settings` - User's strategy settings
- `debts` - Current debt details

No migrations needed!

---

## API Endpoints Summary

1. **GET `/api/debts/adherence`** - Payment adherence analysis
2. **GET `/api/debts/streak`** - Payment streak tracking
3. **GET `/api/debts/projection-update`** - Recalculated projections based on history

---

## UI Components Summary

1. **PaymentAdherenceCard** - Summary card on debts page
2. **PaymentHistoryChart** - Bar chart visualization
3. **PaymentStreakWidget** - Streak display with milestones
4. **AdherenceDetailPage** - Full detailed view
5. **Updated DebtCountdownCard** - Add mini streak indicator

---

## Success Metrics

**User Value:**
- Users can see if they're staying on track with debt payoff
- Motivational streak tracking encourages consistency
- Accurate projections based on actual behavior
- Early warning if falling behind
- Positive reinforcement when ahead of schedule

**Technical:**
- Accurate adherence calculations
- Real-time projection updates
- Smooth animations and transitions
- Fast API responses (<200ms)
- Mobile-responsive design

---

## Timeline Estimate

- **Phase 1-3 (Backend APIs)**: 2-3 hours
- **Phase 4-6 (Core Components)**: 3-4 hours
- **Phase 7 (Detail Page)**: 2-3 hours
- **Phase 8-9 (Integration)**: 1-2 hours
- **Phase 10 (Polish)**: 1-2 hours
- **Phase 11 (Testing)**: 1-2 hours

**Total: 10-16 hours** of focused development

---

## Notes

- Use existing design system (dark mode, colors, spacing)
- Follow patterns from debt payoff strategy
- Reuse components where possible (Card, Button, Charts)
- Mobile-first responsive design
- Accessibility (keyboard nav, screen readers)
- Use Decimal.js for all calculations

---

## Formulas & Calculations

### Adherence Percentage
```
Adherence% = (Actual Payment / Expected Payment) × 100
```

### Overall Adherence Score
```
Weighted average of last 12 months:
- Last 3 months: 50% weight
- Months 4-6: 30% weight
- Months 7-12: 20% weight
```

### Streak Calculation
```
Current Streak:
- Start from most recent month
- Count backward while payment >= minimum
- Stop at first month with no/insufficient payment

Longest Streak:
- Find longest consecutive sequence in history
```

### Projection Adjustment
```
Average Actual Payment = Sum(Last 3 Months) / 3
New Extra Payment = Average Actual - Total Minimums
Recalculate using payoff calculator with new extra payment
```

---

## Future Enhancements (Out of Scope)

- Email/push notifications for off-track warnings
- SMS reminders before payment due
- Gamification: badges, levels, rewards
- Social sharing of streaks
- Payment autopay integration
- Predictive alerts ("You might fall behind next month")
