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

---

## Advanced Interest Calculation System

**Date Implemented:** January 2025

### Overview
Implemented professional-grade interest calculations that accurately handle all major debt types, matching real-world financial institution calculations.

### New Database Fields (Migration 0016)

**Loan Structure:**
- `loanType`: 'revolving' | 'installment'
  - Revolving: Credit cards, lines of credit (variable balance)
  - Installment: Mortgages, car loans, personal loans (fixed payments)
- `loanTermMonths`: Total loan term (e.g., 60 for 5-year, 360 for 30-year)
- `originationDate`: When the loan started

**Interest Calculation:**
- `compoundingFrequency`: 'daily' | 'monthly' | 'quarterly' | 'annually'
- `billingCycleDays`: Days in billing cycle (28-31 for credit cards, default 30)

**Credit Card Specific:**
- `lastStatementDate`: Date of last billing cycle
- `lastStatementBalance`: Balance on last statement

### Interest Calculation Formulas

#### Revolving Credit (Credit Cards, Lines of Credit)

**Daily Compounding (Most Credit Cards):**
```
Daily Rate = APR ÷ 365
Monthly Interest = Balance × Daily Rate × Billing Cycle Days
```
Example: $5,000 @ 18.99% APR, 30-day cycle
- Monthly Interest = $5,000 × (18.99% ÷ 365) × 30 = $77.96

**Monthly Compounding:**
```
Monthly Interest = Balance × (APR ÷ 12)
```

**Quarterly/Annual:** Converted to monthly equivalents

#### Installment Loans (Mortgages, Car Loans, Personal Loans)

**Standard Amortization:**
```
Monthly Interest = Balance × (APR ÷ 12)
Principal = Payment - Monthly Interest
```

This creates the classic amortization schedule where:
- Early payments: Mostly interest
- Late payments: Mostly principal

Example: $20,000 car loan @ 6% APR, $400 payment
- Month 1: Interest = $100, Principal = $300
- Month 60: Interest = $1.92, Principal = $398.08

### Payment Breakdown Storage

**Enhanced Debt Payments Table (Migration 0014):**
- `principalAmount`: Amount applied to reduce debt balance
- `interestAmount`: Amount paid as interest
- `amount`: Total payment (principal + interest)

**Key Feature:** Only `principalAmount` reduces the `remainingBalance`, accurately simulating real debt payoff.

### Updated Components

**1. Payment Calculator (`lib/debts/payment-calculator.ts`)**
- `calculatePaymentBreakdown()` - Main calculation function
- `calculateRevolvingInterest()` - Handles daily/monthly/quarterly/annual compounding
- `calculateInstallmentInterest()` - Handles standard amortization
- Uses `Decimal.js` for precision (no floating-point errors)

**2. Debt Form (`components/debts/debt-form.tsx`)**
- Conditional field display based on `loanType`
- **Installment Loan Section:**
  - Loan term input (with helpful conversions)
  - Origination date picker
- **Revolving Credit Section:**
  - Compounding frequency selector
  - Billing cycle days input
  - Last statement tracking
- Smart defaults and validation

**3. Debt Settings Persistence (Migration 0015)**
- New `debt_settings` table stores:
  - `extraMonthlyPayment`: User's preferred extra payment
  - `preferredMethod`: 'snowball' | 'avalanche'
- Settings auto-load on page mount
- Auto-save with 500ms debounce
- API endpoints: GET/PUT `/api/debts/settings`

**4. Payoff Strategy Calculator Updates**
- Properly rolls over minimum payments when debts are paid off
- Fixed critical bug where paid-off debt's minimum wasn't added to available payment pool
- Now correctly implements snowball/avalanche cascading payment effect

### Real-World Examples

**Credit Card (Daily Compounding):**
```
Balance: $5,000
APR: 18.99%
Billing Cycle: 30 days
Payment: $200

Interest = $5,000 × (0.1899 ÷ 365) × 30 = $77.96
Principal = $200 - $77.96 = $122.04
New Balance = $5,000 - $122.04 = $4,877.96
```

**Car Loan (5-year, 6% APR):**
```
Original: $20,000
Monthly Payment: $386.66 (fixed)
Month 1: Interest $100, Principal $286.66
Month 30: Interest $50, Principal $336.66
Month 60: Interest $1.92, Principal $384.74
```

**Mortgage (30-year, 4.5% APR):**
```
Original: $300,000
Monthly Payment: $1,520 (fixed)
Month 1: Interest $1,125, Principal $395
Month 180: Interest $710, Principal $810
Month 360: Interest $5.66, Principal $1,514.34
```

### Integration Points

All three debt payment locations updated:
1. **Bill-linked debt payments** - Automatic via category matching
2. **Category-based debt payments** - Automatic for debts with their own category
3. **Direct debt payments** - Manual selection in transaction form

Each location:
- Retrieves debt details including new loan fields
- Calculates proper interest/principal split
- Stores breakdown in `debt_payments` table
- Updates `remainingBalance` with ONLY principal amount

### Technical Implementation

**Files Modified:**
- `drizzle/0014_add_principal_interest_to_debt_payments.sql` - Payment tracking
- `drizzle/0015_add_debt_settings.sql` - Settings persistence
- `drizzle/0016_add_debt_loan_fields.sql` - Comprehensive loan tracking
- `lib/db/schema.ts` - Schema definitions
- `lib/debts/payment-calculator.ts` - Interest calculation logic
- `lib/debts/payoff-calculator.ts` - Payoff strategy with proper rollover
- `app/api/debts/settings/route.ts` - Settings API
- `app/api/debts/payoff-strategy/route.ts` - Strategy API
- `app/api/transactions/route.ts` - All 3 payment locations
- `components/debts/debt-form.tsx` - Enhanced form with conditional fields
- `components/debts/debt-payoff-strategy.tsx` - Persistent settings

### Accuracy Improvements

**Before:** Simple monthly interest approximation
```
Interest ≈ Balance × APR ÷ 12
```
- ❌ Incorrect for credit cards (should be daily)
- ❌ Incorrect for installment loans (doesn't amortize)
- ❌ No distinction between debt types

**After:** Professional-grade calculations
- ✅ **Credit cards:** Daily compounding matches statements
- ✅ **Car loans:** Proper amortization like bank calculates
- ✅ **Mortgages:** Accurate interest/principal split
- ✅ **Personal loans:** Correct fixed-payment calculations
- ✅ **Lines of credit:** Flexible compounding options

### User Experience Enhancements

1. **Smart Form:** Only shows relevant fields based on debt type
2. **Persistent Settings:** Extra payment amount and method preference saved
3. **Accurate Projections:** Payoff timelines match real-world scenarios
4. **Proper Rollover:** Minimum payments cascade correctly when debts are paid
5. **Professional Accuracy:** Interest calculations match financial institutions
