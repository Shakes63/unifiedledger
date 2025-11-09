# What-If Scenario Calculator - Implementation Plan

## Overview
Build an interactive calculator that allows users to test different payment scenarios side-by-side to see the impact on their debt payoff timeline and total interest paid.

## Goals
- Allow users to create and compare multiple payment scenarios (3-4 simultaneously)
- Show real-time impact of extra payments or lump sum payments
- Provide clear visual comparison of scenarios
- Help users make informed decisions about debt payoff strategies

## Feature Breakdown

### Core Functionality
1. **Scenario Management**
   - Create new scenarios with custom names
   - Each scenario has:
     - Base monthly extra payment
     - Optional lump sum payments (amount + month)
     - Optional: Starting from a future date
   - Compare up to 4 scenarios side-by-side
   - Default scenario: Current plan (from debt settings)

2. **Scenario Types**
   - **Current Plan**: User's existing extra payment + method
   - **Extra Monthly**: "What if I paid $X more per month?"
   - **Lump Sum**: "What if I paid $X in month Y?"
   - **Combined**: Extra monthly + one or more lump sums

3. **Visualization**
   - Side-by-side comparison cards
   - Each card shows:
     - Scenario name
     - Total months to debt-free
     - Total interest paid
     - Debt-free date
     - Savings vs current plan (time + money)
   - Color-coded to show best/worst options
   - Interactive sliders for real-time adjustment

## Technical Implementation

### Phase 1: Backend Calculator Enhancement

#### File: `lib/debts/payoff-calculator.ts`

**New Interface: `LumpSumPayment`**
```typescript
interface LumpSumPayment {
  month: number;        // Which month to apply (1-based)
  amount: number;       // Lump sum amount
  targetDebtId?: string; // Optional: specific debt, otherwise follows strategy
}
```

**New Interface: `PayoffScenario`**
```typescript
interface PayoffScenario {
  name: string;
  extraMonthlyPayment: number;
  lumpSumPayments: LumpSumPayment[];
  method: PayoffMethod; // 'snowball' | 'avalanche'
  startMonth?: number;  // Optional: start from future month (default: 0)
}
```

**New Function: `calculateScenarioComparison`**
```typescript
export function calculateScenarioComparison(
  debts: DebtInput[],
  scenarios: PayoffScenario[]
): ScenarioComparisonResult
```

**Algorithm Updates:**
- Modify `calculateDebtSchedule` to accept lump sum payments
- Apply lump sums at specified months
- Recalculate payoff timeline after each lump sum
- Track cumulative impact of multiple lump sums

### Phase 2: API Endpoint

#### File: `app/api/debts/scenarios/route.ts`

**Endpoint: POST `/api/debts/scenarios`**

Request body:
```json
{
  "scenarios": [
    {
      "name": "Current Plan",
      "extraMonthlyPayment": 300,
      "lumpSumPayments": [],
      "method": "avalanche"
    },
    {
      "name": "Extra $100/month",
      "extraMonthlyPayment": 400,
      "lumpSumPayments": [],
      "method": "avalanche"
    },
    {
      "name": "Tax Refund",
      "extraMonthlyPayment": 300,
      "lumpSumPayments": [
        { "month": 3, "amount": 5000 }
      ],
      "method": "avalanche"
    }
  ]
}
```

Response:
```json
{
  "scenarios": [
    {
      "name": "Current Plan",
      "totalMonths": 36,
      "totalInterestPaid": 4500,
      "debtFreeDate": "2028-01-01",
      "monthlyBreakdown": [...],
      "savingsVsBaseline": null
    },
    {
      "name": "Extra $100/month",
      "totalMonths": 32,
      "totalInterestPaid": 4100,
      "debtFreeDate": "2027-09-01",
      "monthlyBreakdown": [...],
      "savingsVsBaseline": {
        "monthsSaved": 4,
        "interestSaved": 400
      }
    },
    // ... more scenarios
  ],
  "recommendation": {
    "bestForTime": "Extra $100/month",
    "bestForMoney": "Tax Refund",
    "mostBalanced": "Extra $100/month"
  }
}
```

### Phase 3: Frontend Components

#### Component 1: `components/debts/what-if-calculator.tsx`

**Main container component with:**
- Scenario builder interface
- Comparison results display
- Add/remove scenario buttons
- Reset to defaults

**State Management:**
```typescript
interface Scenario {
  id: string;
  name: string;
  extraMonthlyPayment: number;
  lumpSumPayments: LumpSumPayment[];
  method: PayoffMethod;
}

const [scenarios, setScenarios] = useState<Scenario[]>([
  // Default: Current plan from settings
]);
const [comparisonResults, setComparisonResults] = useState(null);
const [loading, setLoading] = useState(false);
```

#### Component 2: `components/debts/scenario-builder.tsx`

**Individual scenario configuration:**
- Text input: Scenario name
- Number input with slider: Extra monthly payment ($0-$2000)
- Lump sum payment builder:
  - Add button to add new lump sum
  - Each lump sum: Amount + Month selector
  - Remove button for each lump sum
- Method toggle: Snowball/Avalanche
- Delete scenario button

**Visual Design:**
```
┌─────────────────────────────────────┐
│ 📊 Scenario: Extra $100/month       │
├─────────────────────────────────────┤
│ Extra Monthly Payment:              │
│ [$400] ────●──────────── $0-$2000   │
│                                     │
│ Lump Sum Payments:                  │
│ • Month 3: $5,000 [Remove]          │
│ • Month 12: $3,000 [Remove]         │
│ [+ Add Lump Sum]                    │
│                                     │
│ Method: [Snowball] [Avalanche]      │
│                                     │
│ [Delete Scenario]                   │
└─────────────────────────────────────┘
```

#### Component 3: `components/debts/scenario-comparison-card.tsx`

**Displays results for one scenario:**
```
┌─────────────────────────────────────┐
│ Current Plan                         │
│ ─────────────────────────────────   │
│ 🗓️ Time to Debt-Free: 36 months    │
│ 📅 Debt-Free Date: Jan 2028         │
│ 💰 Total Interest: $4,500           │
│                                     │
│ Baseline Scenario                   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Extra $100/month         🎯 BEST    │
│ ─────────────────────────────────   │
│ 🗓️ Time to Debt-Free: 32 months    │
│ 📅 Debt-Free Date: Sep 2027         │
│ 💰 Total Interest: $4,100           │
│                                     │
│ ✅ Saves 4 months                   │
│ ✅ Saves $400 in interest           │
└─────────────────────────────────────┘
```

**Features:**
- Green badge for best scenario
- Red/amber indicators for worse scenarios
- Savings highlighted in green
- Click to expand and see month-by-month breakdown

#### Component 4: `components/debts/scenario-timeline-chart.tsx`

**Visual timeline comparison:**
- Horizontal bar chart
- Each scenario as a colored bar
- Length represents months to payoff
- Hover shows details
- Lump sum payments marked as icons on bars

### Phase 4: Integration

#### Update: `app/dashboard/debts/page.tsx`

Add new collapsible section above current payoff strategy:
```typescript
{stats && stats.activeDebtCount > 0 && (
  <div className="space-y-4">
    {/* What-If Calculator Section */}
    <button onClick={() => setShowWhatIf(!showWhatIf)}>
      What-If Scenario Calculator
    </button>
    {showWhatIf && <WhatIfCalculator />}

    {/* Existing Payoff Strategy Section */}
    <button onClick={() => setShowStrategy(!showStrategy)}>
      Debt Payoff Strategy
    </button>
    {showStrategy && <DebtPayoffStrategy />}
  </div>
)}
```

### Phase 5: Enhanced Features

#### Quick Scenario Templates
Pre-built scenarios users can add with one click:
- "Pay $50 more per month"
- "Pay $100 more per month"
- "Pay $200 more per month"
- "Apply tax refund ($5k in month 4)"
- "Apply bonus ($3k in month 12)"
- "Aggressive payoff (double payments)"

#### Save/Load Scenarios
- Save favorite scenarios to localStorage
- Load saved scenarios for quick comparison
- Share scenario URLs with financial advisors/partners

#### Mobile Optimizations
- Swipeable cards on mobile
- Collapsed view showing only key metrics
- Expand on tap for full details

## Implementation Steps

### Step 1: Backend Calculator (2-3 hours)
1. Add `LumpSumPayment` and `PayoffScenario` interfaces
2. Update `calculateDebtSchedule` to handle lump sums
3. Create `calculateScenarioComparison` function
4. Add comprehensive tests for lump sum calculations

### Step 2: API Endpoint (1 hour)
1. Create `/api/debts/scenarios/route.ts`
2. Validate request data
3. Call calculator with scenarios
4. Return comparison results

### Step 3: Scenario Builder Component (2 hours)
1. Create `scenario-builder.tsx`
2. Add form controls for all scenario parameters
3. Implement add/remove lump sum payments
4. Add validation and error handling

### Step 4: Comparison Display (2 hours)
1. Create `what-if-calculator.tsx` container
2. Create `scenario-comparison-card.tsx`
3. Implement scenario comparison grid layout
4. Add color-coding and savings highlights

### Step 5: Visual Timeline (1-2 hours)
1. Create `scenario-timeline-chart.tsx`
2. Use recharts to build horizontal bar chart
3. Add lump sum markers
4. Implement hover tooltips

### Step 6: Integration (1 hour)
1. Add to debts page
2. Wire up all components
3. Test full flow
4. Polish UI/UX

### Step 7: Testing (1 hour)
1. Test various scenario combinations
2. Test edge cases (very large lump sums, many lump sums)
3. Test mobile responsiveness
4. Test with real debt data

## Testing Scenarios

### Test Case 1: Extra Monthly Only
- Input: $100 extra per month
- Expected: Shorter timeline, less interest
- Verify: Correct month-by-month breakdown

### Test Case 2: Single Lump Sum
- Input: $5,000 lump sum in month 3
- Expected: Sudden balance drop in month 3
- Verify: Proper recalculation after lump sum

### Test Case 3: Multiple Lump Sums
- Input: $3k in month 4, $2k in month 10
- Expected: Two balance drops
- Verify: Cumulative effect correct

### Test Case 4: Combined Strategy
- Input: $200 extra monthly + $5k lump sum
- Expected: Fastest payoff
- Verify: Both factors applied correctly

### Test Case 5: Edge Cases
- Zero extra payment + zero lump sums = current plan
- Very large lump sum that pays off all debts immediately
- Lump sum in month 1 vs month 24

## UI/UX Considerations

### Design Principles
1. **Progressive Disclosure**: Start simple, reveal complexity as needed
2. **Visual Hierarchy**: Most impactful info (savings) most prominent
3. **Real-Time Feedback**: Show results as user adjusts sliders
4. **Mobile-First**: Ensure usability on all screen sizes
5. **Accessibility**: Proper labels, keyboard navigation, screen reader support

### Color Coding
- **Green**: Best scenario, savings, positive outcomes
- **Blue**: Current/baseline scenario
- **Amber**: Middle scenarios
- **Red**: Worst scenario (if showing worst)
- **Gray**: Neutral information

### Loading States
- Show skeleton loaders while calculating
- Debounce slider input (300ms) to avoid excessive API calls
- Cache results for unchanged scenarios

### Error Handling
- Validate scenario inputs before API call
- Show friendly error messages
- Provide suggestions for fixing errors
- Don't let errors break entire comparison

## Future Enhancements
- Save scenarios to database for persistence across sessions
- Share scenarios with household members
- Export scenario comparison to PDF
- Email scenario results
- Integration with calendar to set reminders for lump sum payments
- Track actual vs projected scenario performance
- AI-powered scenario recommendations based on spending patterns

## Success Metrics
- User creates at least 2 scenarios to compare
- User adjusts extra payment slider at least 3 times
- User adds at least 1 lump sum payment
- Time spent on feature > 2 minutes (indicates engagement)
- User changes debt payment strategy after using calculator

---

**Estimated Total Time**: 10-12 hours
**Priority**: High (most requested feature)
**Dependencies**: None (all required infrastructure exists)
**Risk**: Low (purely additive, no changes to existing features)
