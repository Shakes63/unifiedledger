# Phase 13: Dashboard Widgets Implementation Plan

## Overview
Update dashboard widgets to use the new unified debt architecture (credit accounts + debt bills) instead of the legacy `debts` table. Also add a new "Next Payment Due" widget for quick visibility into upcoming bills.

## Current State Analysis

### Debt-Free Countdown Widget (`debt-countdown-card.tsx` / `debt-free-countdown.tsx`)
- **Current**: Uses `/api/debts/countdown` which queries the legacy `debts` table
- **Issues**: Legacy `debts` table is being phased out in favor of:
  - Credit accounts (`accounts` table with `type='credit'` or `type='line_of_credit'`)
  - Debt bills (`bills` table with `isDebt=true`)

### Credit Utilization Widget (`credit-utilization-widget.tsx`)
- **Current**: Uses `/api/debts/credit-utilization` which queries `debts` table with `type='credit_card'`
- **Issues**: Should use `accounts` table with credit types for the new architecture

### Enhanced Bills Widget (`enhanced-bills-widget.tsx`)
- **Current**: Shows all bills for current month with progress tracking
- **Missing**: A compact "Next Payment Due" widget showing just the next 3-5 upcoming payments prominently

## Implementation Tasks

### Task 1: Update `/api/debts/countdown` API
Update to use unified debt sources from the new architecture.

**File**: `app/api/debts/countdown/route.ts`

**Changes**:
1. Import `accounts` and `bills` tables instead of `debts`
2. Fetch credit accounts where `type IN ('credit', 'line_of_credit')` and `isActive=true`
3. Fetch debt bills where `isDebt=true` and `isActive=true`
4. Combine and normalize data for payoff calculations
5. Use household settings for strategy preference (already migrated to `householdSettings`)

**Data Mapping**:
| Unified Source | Field | From accounts | From bills |
|---------------|-------|---------------|------------|
| balance | remainingBalance | `Math.abs(currentBalance)` | `remainingBalance` |
| interestRate | interestRate | `interestRate` | `billInterestRate` |
| minimumPayment | minimumPayment | `minimumPaymentAmount` | `minimumPayment` |
| includeInStrategy | includeInPayoffStrategy | `includeInPayoffStrategy` | `includeInPayoffStrategy` |
| name | name | `name` | `name` |
| color | color | `color` | `billColor` |
| additionalPayment | additional | `additionalMonthlyPayment` | `billAdditionalMonthlyPayment` |

**Updated Response**: Same structure, but data comes from unified sources

### Task 2: Update `/api/debts/credit-utilization` API
Update to use accounts table instead of debts table.

**File**: `app/api/debts/credit-utilization/route.ts`

**Changes**:
1. Query `accounts` table where `type IN ('credit', 'line_of_credit')` and `isActive=true`
2. Include `creditLimit` check (only cards with limits set)
3. Map account fields to existing response structure:
   - `id` -> `debtId`
   - `name` -> `name`
   - `Math.abs(currentBalance)` -> `balance`
   - `creditLimit` -> `creditLimit`/`limit`
4. Calculate utilization as before

**No changes needed to widget component** - API returns same structure

### Task 3: Create `/api/bills/next-due` API
New API endpoint for the Next Payment Due widget.

**File**: `app/api/bills/next-due/route.ts` (new)

**Functionality**:
1. Fetch upcoming bill instances (status='pending')
2. Include overdue bills (status='overdue')
3. Order by due date (soonest first)
4. Limit to configurable count (default: 5)
5. Include linked credit card account info for card payment bills

**Response Structure**:
```typescript
{
  bills: Array<{
    id: string;           // Bill instance ID
    billId: string;       // Parent bill ID
    billName: string;
    dueDate: string;
    expectedAmount: number;
    actualAmount?: number;
    status: 'pending' | 'overdue';
    daysUntilDue: number; // negative if overdue
    isOverdue: boolean;
    // For credit card payment bills
    linkedAccount?: {
      id: string;
      name: string;
      type: 'credit' | 'line_of_credit';
      currentBalance: number;
      creditLimit: number;
    };
    // Autopay info
    isAutopay: boolean;
    autopayAmount?: number;
    autopayDays?: number;
  }>;
  summary: {
    overdueCount: number;
    overdueTotal: number;
    nextDueDate: string;
    next7DaysTotal: number;
    next7DaysCount: number;
  };
}
```

### Task 4: Create `NextPaymentDueWidget` Component
New compact widget for dashboard showing next upcoming payments.

**File**: `components/dashboard/next-payment-due-widget.tsx` (new)

**Features**:
1. Shows next 3-5 upcoming bills
2. Overdue bills highlighted at top with red styling
3. Days until due shown prominently
4. Credit card payment bills show linked card name
5. Autopay indicator badge
6. Link to bills page for full list
7. Empty state when no upcoming bills

**Design**:
- Compact card format matching existing widget style
- Uses semantic theme variables
- Mobile responsive (stacks on small screens)
- Click row to go to bill details or mark paid

### Task 5: Update Dashboard Page
Add the new widget to the dashboard layout.

**File**: `app/dashboard/page.tsx`

**Changes**:
1. Import `NextPaymentDueWidget`
2. Add widget in a prominent position (after enhanced bills widget or in Debt & Credit section)
3. Consider making it visible by default (not collapsed)

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `app/api/debts/countdown/route.ts` | Modify | Use unified debt sources |
| `app/api/debts/credit-utilization/route.ts` | Modify | Use accounts table |
| `app/api/bills/next-due/route.ts` | Create | New API for next payments |
| `components/dashboard/next-payment-due-widget.tsx` | Create | New widget component |
| `app/dashboard/page.tsx` | Modify | Add new widget |

## Testing Plan

1. **Countdown Widget**
   - Test with credit accounts only
   - Test with debt bills only
   - Test with both types combined
   - Verify strategy calculations match legacy behavior
   - Test household switching

2. **Credit Utilization Widget**
   - Test with credit card accounts
   - Test with line of credit accounts
   - Test with no credit accounts (should show empty state)
   - Verify utilization calculations

3. **Next Payment Due Widget**
   - Test with overdue bills
   - Test with pending bills
   - Test with autopay bills
   - Test with credit card payment bills
   - Test empty state
   - Test household switching

## Migration Notes

- No database migration needed (uses existing tables)
- Legacy `debts` table data not migrated - users should create accounts/bills
- Backwards compatible - widgets handle both old and new data if present

## Dependencies
- Phase 1.1-1.5: Schema updates (COMPLETED)
- Phase 2-4: Account and bill form updates (COMPLETED)
- Unified debt API already exists (`/api/debts/unified`)

