# Debt Payoff Strategy System Plan

## Status: ✅ COMPLETED

## Overview
Build a comprehensive debt payoff calculator that compares **Snowball** (smallest balance first) and **Avalanche** (highest interest first) methods, showing which debt to pay next and projected payoff timelines.

**Implementation completed successfully!** All components have been built and integrated into the debts page.

## Components to Create

### 1. **Debt Payoff Strategy Calculator** (`lib/debts/payoff-calculator.ts`)
- Calculate payoff order for both methods:
  - **Snowball**: Sort by `remainingBalance` (ascending)
  - **Avalanche**: Sort by `interestRate` (descending)
- Calculate monthly interest accrual
- Project payoff timeline with month-by-month breakdown
- Calculate total interest paid under each method
- Determine payoff date for each debt
- Calculate time/interest savings comparison

### 2. **Debt Payoff Strategy Component** (`components/debts/debt-payoff-strategy.tsx`)
**Features:**
- Toggle switch: Snowball ↔ Avalanche
- Input field: Extra monthly payment amount (beyond minimums)
- Debt priority list showing payoff order
- Next debt recommendation card with:
  - Debt name and current balance
  - Recommended payment amount
  - Months until payoff
  - Total interest for this debt
- Comparison metrics:
  - Total payoff time (both methods)
  - Total interest paid (both methods)
  - Savings (time & money)

### 3. **Payoff Timeline Visualization** (`components/debts/payoff-timeline.tsx`)
- Horizontal timeline chart showing:
  - Each debt as a colored bar
  - Length = months to payoff
  - Stacked to show overall completion
- Month-by-month payment breakdown table
- Milestone markers (25%, 50%, 75%, 100% debt-free)

### 4. **API Endpoint** (`app/api/debts/payoff-strategy/route.ts`)
- Accept parameters:
  - Method: 'snowball' | 'avalanche'
  - Extra payment amount
  - Optional: User preference for default method
- Return:
  - Ordered debt list with payoff schedule
  - Next recommended payment
  - Timeline data
  - Comparison metrics

## Data Flow
1. Fetch all active debts from existing `/api/debts?status=active`
2. User inputs extra monthly payment amount
3. Calculator runs both methods in parallel
4. Display results side-by-side with toggle
5. Highlight recommended method based on savings

## UI Layout (New Section on Debts Page)
```
┌─────────────────────────────────────┐
│  Debt Payoff Strategy               │
│  [Snowball] ←→ [Avalanche]          │
│  Extra Payment: [$____] / month     │
├─────────────────────────────────────┤
│  📍 Pay This Next:                  │
│  Credit Card A - $2,500             │
│  Pay: $500/month → 5 months         │
│  Interest: $125                     │
├─────────────────────────────────────┤
│  📊 Your Payoff Order:              │
│  1. Credit Card A - $2,500          │
│  2. Student Loan - $15,000          │
│  3. Auto Loan - $18,000             │
├─────────────────────────────────────┤
│  💰 Comparison:                     │
│  Snowball: 36 months, $5,200 int    │
│  Avalanche: 34 months, $4,800 int   │
│  Savings: 2 months, $400            │
└─────────────────────────────────────┘
```

## Implementation Steps
1. Create calculator utility with both algorithms
2. Build API endpoint for strategy calculation
3. Create strategy UI component with toggle
4. Add timeline visualization component
5. Integrate into existing debts page
6. Add persistence for user's preferred method

## Existing Schema (Reference)

### Debts Table
- `id`: Primary key
- `userId`: User reference
- `name`: Debt name
- `description`: Optional description
- `creditorName`: Creditor/lender name
- `originalAmount`: Initial debt amount
- `remainingBalance`: Current balance owed
- `minimumPayment`: Minimum monthly payment
- `interestRate`: APR percentage
- `interestType`: 'fixed' | 'variable' | 'none'
- `accountId`: Optional linked account
- `categoryId`: Auto-created category for tracking payments
- `type`: 'credit_card' | 'personal_loan' | 'student_loan' | 'mortgage' | 'auto_loan' | 'medical' | 'other'
- `status`: 'active' | 'paid_off' | 'delinquent'
- `priority`: 1-5 rating
- `color`: UI color
- `icon`: UI icon
- `startDate`: When debt was incurred
- `targetPayoffDate`: Goal completion date
- `notes`: Additional notes

### Debt Payments Table
- `id`: Primary key
- `debtId`: Reference to debt
- `amount`: Payment amount
- `date`: Payment date
- `transactionId`: Link to transaction
- `principalAmount`: Amount to principal
- `interestAmount`: Amount to interest
- `notes`: Payment notes

## Algorithm Details

### Snowball Method
1. List all debts by `remainingBalance` (smallest to largest)
2. Pay minimums on all debts
3. Apply extra payment to smallest debt
4. When smallest is paid off, roll that payment to next smallest
5. Continue until all debts paid

**Pros:**
- Quick psychological wins
- Builds momentum
- Simplifies finances faster

**Cons:**
- May pay more interest overall
- Takes longer mathematically

### Avalanche Method
1. List all debts by `interestRate` (highest to lowest)
2. Pay minimums on all debts
3. Apply extra payment to highest interest debt
4. When highest rate is paid off, roll payment to next highest
5. Continue until all debts paid

**Pros:**
- Mathematically optimal
- Saves most money on interest
- Pays off faster overall

**Cons:**
- Slower initial wins
- May feel discouraging

## Calculation Example

**Input:**
- Debt A: $2,500 balance, 18% APR, $100 minimum
- Debt B: $15,000 balance, 6% APR, $200 minimum
- Debt C: $18,000 balance, 4% APR, $250 minimum
- Extra payment: $300/month

**Snowball Order:**
1. Debt A ($2,500) - pay $400/month
2. Debt B ($15,000) - then pay $600/month
3. Debt C ($18,000) - then pay $850/month

**Avalanche Order:**
1. Debt A ($2,500 @ 18%) - pay $400/month
2. Debt B ($15,000 @ 6%) - then pay $600/month
3. Debt C ($18,000 @ 4%) - then pay $850/month

*Note: In this example, both methods start with Debt A because it has both the smallest balance AND highest interest rate.*

## Future Enhancements
- Save custom payoff strategies
- What-if scenarios (extra lump sum payments)
- Notifications when switching methods saves more
- Integration with transaction entry to track adherence
- Export payoff schedule to PDF/CSV
- Goal tracking with milestones
- Celebration animations when debts are paid off
- Share progress with household members
- Budget integration (auto-calculate available extra payment)
- Refinancing calculator (show savings from lower rates)
- Minimum payment vs extra payment comparison charts

---

## Implementation Summary

**Date Completed:** January 2025

### Files Created:
1. **`lib/debts/payoff-calculator.ts`** - Core calculator with Snowball & Avalanche algorithms
2. **`app/api/debts/payoff-strategy/route.ts`** - API endpoint for strategy calculations
3. **`components/debts/debt-payoff-strategy.tsx`** - Main strategy UI component
4. **`components/debts/payoff-timeline.tsx`** - Timeline visualization component

### Features Implemented:
- ✅ Snowball method (smallest balance first)
- ✅ Avalanche method (highest interest rate first)
- ✅ Method comparison with savings calculations
- ✅ Extra monthly payment input
- ✅ "Pay This Next" recommendation card
- ✅ Payoff order visualization
- ✅ Time and interest savings display
- ✅ Month-by-month payment breakdown
- ✅ Timeline visualization with milestone markers
- ✅ Collapsible section on debts page
- ✅ Real-time recalculation on extra payment change

### Key Technical Details:
- Uses `Decimal.js` for precise financial calculations
- Calculates monthly interest accrual accurately
- Handles edge cases (0% interest, large debts, etc.)
- Responsive UI design following dark mode system
- Fully integrated into existing debt management page
- Shows only when user has active debts

### User Benefits:
- Clear guidance on which debt to pay next
- Understand time and money savings between methods
- Make informed decisions about extra payments
- See complete payoff timeline at a glance
- Visual comparison to choose best strategy
