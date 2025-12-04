# Phase 8: Payoff Strategy & Per-Debt Inclusion

## Overview

Phase 8 updates the payoff strategy calculations to use the unified debt model (credit accounts + debt bills) instead of the legacy `debts` table. This includes per-debt strategy inclusion toggles, settings migration, and milestone integration.

## Goals

1. **Update calculations to pull from accounts (credit) + bills (isDebt)**
2. **Filter by `includeInPayoffStrategy` flag**
3. **Unified debt list from both sources**
4. **Move payoff settings to household settings**
5. **Milestones on bills and accounts** (already exists in `billMilestones` table)
6. **Handle debts excluded from strategy separately**
7. **Recalculate when debt paid off or toggled**

## Current State Analysis

### Existing Infrastructure (Already Complete)
- `includeInPayoffStrategy` field exists on both `accounts` and `bills` tables
- `/api/debts/unified` endpoint combines credit accounts + debt bills
- `billMilestones` table supports both `billId` and `accountId` (Phase 1.3)
- `householdSettings` table has debt strategy fields (`debtStrategyEnabled`, `debtPayoffMethod`, `extraMonthlyPayment`, `paymentFrequency`)

### Issues to Fix
- `/api/debts/payoff-strategy` still uses legacy `debts` table
- `/api/debts/settings` uses old `debtSettings` table instead of `householdSettings`
- UI has "TODO: Implement strategy toggle API" comment
- No API endpoint to toggle `includeInPayoffStrategy` for accounts/bills

## Implementation Tasks

### Task 1: Create Strategy Toggle API Endpoints

**File:** `app/api/debts/strategy-toggle/route.ts` (new)

```typescript
// POST - Toggle includeInPayoffStrategy for an account or bill
// Body: { source: 'account' | 'bill', id: string, include: boolean }
```

**Steps:**
1. Create new API route file
2. Validate ownership (account/bill belongs to user's household)
3. Update `includeInPayoffStrategy` field
4. Return updated debt object

**File:** `app/api/accounts/[id]/strategy/route.ts` (new)
**File:** `app/api/bills/[id]/strategy/route.ts` (new)

Alternative: Create individual endpoints for cleaner REST patterns.

### Task 2: Update Payoff Strategy API to Use Unified Sources

**File:** `app/api/debts/payoff-strategy/route.ts`

**Current:**
- Fetches from `debts` table
- Uses `debtSettings` for payment frequency

**Updated:**
- Fetch credit accounts where `type IN ('credit', 'line_of_credit')` and `isActive = true`
- Fetch bills where `isDebt = true` and `isActive = true`
- Filter by `includeInPayoffStrategy = true`
- Use `householdSettings` for strategy settings
- Transform to `DebtInput` format for calculator

**DebtInput Mapping:**

| Source | DebtInput Field | Source Field |
|--------|-----------------|--------------|
| Account | id | account.id |
| Account | name | account.name |
| Account | remainingBalance | account.currentBalance |
| Account | minimumPayment | account.minimumPaymentAmount |
| Account | interestRate | account.interestRate |
| Account | type | account.type |
| Bill | id | bill.id |
| Bill | name | bill.name |
| Bill | remainingBalance | bill.remainingBalance |
| Bill | minimumPayment | bill.minimumPayment |
| Bill | interestRate | bill.billInterestRate |
| Bill | type | bill.debtType |

### Task 3: Migrate Settings from debtSettings to householdSettings

**Option A: API-level migration (recommended)**
- Update `/api/debts/settings` to read/write from `householdSettings`
- Keep backward compatibility by checking `debtSettings` as fallback

**Option B: Database migration**
- Create migration to copy data from `debtSettings` to `householdSettings`
- Mark `debtSettings` as deprecated

**File changes:**
- `app/api/debts/settings/route.ts` - Update to use `householdSettings`

### Task 4: Update Unified Debts API with Strategy Data

**File:** `app/api/debts/unified/route.ts`

Add optional `includeStrategy=true` query param that enriches response with:
- Payoff timeline for each debt
- Recommended payment amount
- Order in payoff sequence

### Task 5: Update Debts Page UI

**File:** `app/dashboard/debts/page.tsx`

1. Implement `onToggleStrategy` handler (currently shows toast "coming soon")
2. Update to use unified payoff strategy
3. Show strategy-excluded debts in separate section

**File:** `components/debts/unified-debt-card.tsx`

1. Add toggle switch for `includeInPayoffStrategy`
2. Show payoff timeline when in strategy
3. Visual distinction for excluded debts

### Task 6: Update Related Components

**Files to update:**
- `components/debts/debt-payoff-strategy.tsx` - Use unified sources
- `components/debts/what-if-calculator.tsx` - Use unified sources
- `components/dashboard/debt-free-countdown.tsx` - Use unified sources

### Task 7: Milestone Integration

**File:** `lib/debts/milestone-utils.ts` (new or update existing)

Functions:
- `checkAndCreateMilestones(debtSource, debtId, currentBalance, originalBalance, householdId)`
- `getMilestonesForDebt(source, debtId)`

**Already exists:** `billMilestones` table with `billId` and `accountId` columns

### Task 8: Update Debt Stats API

**File:** `app/api/debts/stats/route.ts`

Update to use unified sources for:
- Total debt balance
- Active debt count
- Percent paid off

## API Response Changes

### GET /api/debts/payoff-strategy

**Current response:** Uses legacy debts data

**New response:**
```typescript
{
  method: 'snowball' | 'avalanche',
  paymentFrequency: 'weekly' | 'biweekly' | 'monthly',
  totalMonths: number,
  totalInterestPaid: number,
  debtFreeDate: string,
  payoffOrder: Array<{
    debtId: string,
    debtName: string,
    source: 'account' | 'bill',  // NEW
    sourceType: string,           // NEW
    remainingBalance: number,
    interestRate: number,
    minimumPayment: number,
    plannedPayment: number,
    order: number,
    color?: string,
  }>,
  rolldownPayments: Array<...>,
  schedules: Array<...>,
  // Stats for excluded debts
  excludedDebts: {                // NEW
    count: number,
    totalBalance: number,
  }
}
```

### POST /api/debts/strategy-toggle

**Request:**
```typescript
{
  source: 'account' | 'bill',
  id: string,
  include: boolean
}
```

**Response:**
```typescript
{
  success: true,
  debt: UnifiedDebt
}
```

## Database Changes

None required - all fields already exist:
- `accounts.includeInPayoffStrategy`
- `bills.includeInPayoffStrategy`
- `householdSettings.debtStrategyEnabled`
- `householdSettings.debtPayoffMethod`
- `householdSettings.extraMonthlyPayment`
- `householdSettings.paymentFrequency`
- `billMilestones.billId` / `billMilestones.accountId`

## Testing Checklist

- [ ] Strategy toggle works for credit accounts
- [ ] Strategy toggle works for debt bills
- [ ] Payoff calculations use unified sources
- [ ] Settings properly read from householdSettings
- [ ] Excluded debts shown separately in UI
- [ ] Milestones created for unified debts
- [ ] Debt-free countdown uses unified data
- [ ] What-if calculator uses unified sources

## Rollout Plan

1. **Task 1:** Create strategy toggle endpoints
2. **Task 2:** Update payoff-strategy API (with feature flag)
3. **Task 3:** Migrate settings
4. **Task 4:** Update unified API
5. **Task 5-6:** Update UI components
6. **Task 7:** Milestone integration
7. **Task 8:** Update stats API
8. Remove feature flags

## Estimated Time

- Task 1: Strategy Toggle API - 30 min
- Task 2: Payoff Strategy API Update - 1 hour
- Task 3: Settings Migration - 30 min
- Task 4: Unified API Enhancement - 30 min
- Task 5-6: UI Updates - 1.5 hours
- Task 7: Milestone Integration - 30 min
- Task 8: Stats API Update - 30 min

**Total: ~5 hours**

