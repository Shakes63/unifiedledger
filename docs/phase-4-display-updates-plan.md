# Phase 4: Display Updates Implementation Plan

## Overview

Phase 4 updates the UI across accounts, debts, and dashboard pages to properly display credit card and line of credit data introduced in Phase 1-3. This includes grouping accounts by type, unifying debt views, and adding historical charts.

**Related Architecture Document:** `docs/unified-debt-bill-credit-card-architecture.md`

**Estimated Time:** 2-3 days  
**Priority:** High - User-facing improvements  
**Dependencies:** Phases 1-3 (Schema, Account Form, Bill Form)  
**Status:** COMPLETED 2025-12-03  
**Last Updated:** 2025-12-03

---

## Phase 4 Breakdown

| Task | Description | Est. Time | Status |
|------|-------------|-----------|--------|
| 4.1 | Accounts Page Grouping | 3-4 hours | COMPLETED |
| 4.2 | Available Credit Display | 2-3 hours | COMPLETED |
| 4.3 | Unified Debts Page | 4-5 hours | COMPLETED |
| 4.4 | Dashboard Cash vs Credit Separation | 2-3 hours | COMPLETED |
| 4.5 | Utilization Trends Chart | 3-4 hours | COMPLETED |
| 4.6 | Balance History Chart | 3-4 hours | COMPLETED |
| 4.7 | Strategy Inclusion Status | 1-2 hours | COMPLETED |
| 4.8 | Overpayment/Credit Balance Display | 1-2 hours | COMPLETED |

---

## Task 4.1: Accounts Page Grouping

### Current State
- All accounts displayed in a flat grid, sorted by sort order
- No visual separation between cash/debit accounts and credit accounts

### Target State
- Accounts grouped into sections:
  - "Cash & Debit Accounts" (checking, savings, cash, investment)
  - "Credit Accounts" (credit, line_of_credit)
- Section headers with totals
- Visual distinction between sections

### Implementation

#### 4.1.1 Update AccountsPage Component

**File:** `app/dashboard/accounts/page.tsx`

```typescript
// Add type grouping
const cashAccountTypes = ['checking', 'savings', 'cash', 'investment'];
const creditAccountTypes = ['credit', 'line_of_credit'];

const cashAccounts = accounts.filter(acc => cashAccountTypes.includes(acc.type));
const creditAccounts = accounts.filter(acc => creditAccountTypes.includes(acc.type));

// Calculate group totals
const cashTotal = cashAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
const creditBalance = creditAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
const totalCreditLimit = creditAccounts.reduce((sum, acc) => sum + (acc.creditLimit || 0), 0);
const totalAvailableCredit = totalCreditLimit - Math.abs(creditBalance);
```

#### 4.1.2 Create Account Group Section Component

**File:** `components/accounts/account-group-section.tsx`

```typescript
interface AccountGroupSectionProps {
  title: string;
  subtitle?: string;
  accounts: Account[];
  totalLabel: string;
  totalValue: string;
  totalColor?: string;
  secondaryTotal?: { label: string; value: string; color?: string };
  onEdit: (account: Account) => void;
  onDelete: (accountId: string) => void;
}

export function AccountGroupSection({
  title,
  subtitle,
  accounts,
  totalLabel,
  totalValue,
  totalColor = 'var(--color-foreground)',
  secondaryTotal,
  onEdit,
  onDelete,
}: AccountGroupSectionProps) {
  if (accounts.length === 0) return null;

  return (
    <div className="mb-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{totalLabel}</p>
          <p className="text-xl font-bold" style={{ color: totalColor }}>
            {totalValue}
          </p>
          {secondaryTotal && (
            <>
              <p className="text-xs text-muted-foreground mt-1">{secondaryTotal.label}</p>
              <p className="text-sm font-medium" style={{ color: secondaryTotal.color }}>
                {secondaryTotal.value}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Task 4.2: Available Credit Display

### Current State
- Credit cards show balance and utilization
- Lines of credit not distinguished from credit cards
- No aggregate available credit

### Target State
- Enhanced AccountCard for lines of credit:
  - Show draw period status
  - Show repayment period if applicable
  - Variable vs fixed rate indicator
- Summary cards show:
  - Total Available Credit
  - Overall Utilization %

### Implementation

#### 4.2.1 Update Account Interface

**File:** `app/dashboard/accounts/page.tsx`

Add fields from schema:
```typescript
interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'line_of_credit' | 'investment' | 'cash';
  bankName?: string;
  accountNumberLast4?: string;
  currentBalance: number;
  creditLimit?: number;
  color: string;
  icon: string;
  // New credit-specific fields
  interestRate?: number;
  interestType?: 'fixed' | 'variable';
  drawPeriodEndDate?: string;
  repaymentPeriodEndDate?: string;
  includeInPayoffStrategy?: boolean;
  statementBalance?: number;
  statementDueDate?: string;
  minimumPaymentAmount?: number;
}
```

#### 4.2.2 Enhance AccountCard for Line of Credit

**File:** `components/accounts/account-card.tsx`

Add line of credit specific display:
- APR with fixed/variable indicator
- Draw period countdown (if applicable)
- Repayment period status
- Strategy inclusion badge

---

## Task 4.3: Unified Debts Page

### Current State
- Debts page only shows `debts` table records
- Credit card balances shown on Accounts page
- Debt bills not integrated

### Target State
- Unified debt view combining:
  1. Credit card balances (from accounts where type='credit' or 'line_of_credit')
  2. Debt bills (from bills where isDebt=true)
- Filter tabs: All | Credit Cards | Lines of Credit | Loans | Other
- Unified payoff strategy across all debt types

### Implementation

#### 4.3.1 Create API Endpoint for Unified Debts

**File:** `app/api/debts/unified/route.ts`

```typescript
export async function GET(request: Request) {
  // Fetch credit accounts (credit cards + lines of credit)
  const creditAccounts = await db.select()
    .from(accounts)
    .where(and(
      eq(accounts.householdId, householdId),
      inArray(accounts.type, ['credit', 'line_of_credit']),
      eq(accounts.isActive, true)
    ));

  // Fetch debt bills
  const debtBills = await db.select()
    .from(bills)
    .where(and(
      eq(bills.householdId, householdId),
      eq(bills.isDebt, true),
      eq(bills.isActive, true)
    ));

  // Normalize to unified format
  const unifiedDebts = [
    ...creditAccounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      source: 'account' as const,
      sourceType: acc.type,
      balance: Math.abs(acc.currentBalance),
      creditLimit: acc.creditLimit,
      interestRate: acc.interestRate,
      interestType: acc.interestType,
      minimumPayment: acc.minimumPaymentAmount,
      includeInPayoffStrategy: acc.includeInPayoffStrategy,
      color: acc.color,
      // For credit cards
      statementBalance: acc.statementBalance,
      statementDueDate: acc.statementDueDate,
      // For lines of credit
      drawPeriodEndDate: acc.drawPeriodEndDate,
      repaymentPeriodEndDate: acc.repaymentPeriodEndDate,
    })),
    ...debtBills.map(bill => ({
      id: bill.id,
      name: bill.name,
      source: 'bill' as const,
      sourceType: bill.debtType || 'other',
      balance: bill.remainingBalance || 0,
      originalBalance: bill.originalBalance,
      interestRate: bill.interestRate,
      interestType: bill.interestType,
      minimumPayment: bill.minimumPayment,
      includeInPayoffStrategy: bill.includeInPayoffStrategy,
      color: bill.color,
      // Loan-specific
      debtType: bill.debtType,
    })),
  ];

  return Response.json({ debts: unifiedDebts });
}
```

#### 4.3.2 Create UnifiedDebtCard Component

**File:** `components/debts/unified-debt-card.tsx`

A versatile card component that handles:
- Credit cards (show utilization, statement info)
- Lines of credit (show draw period status)
- Loan debts (show remaining balance, original amount)

---

## Task 4.4: Dashboard Cash vs Credit Separation

### Current State
- CompactStatsBar shows "Total Balance" which combines everything
- No visibility into credit availability

### Target State
- Separate stats:
  - "Cash Balance" (checking + savings + cash + investment)
  - "Credit Used" (total balance on credit accounts)
  - "Available Credit" (credit limit - balance)
- Optional: Net Worth stat (Cash - Credit Used)

### Implementation

#### 4.4.1 Update CompactStatsBar

**File:** `components/dashboard/compact-stats-bar.tsx`

```typescript
// Split accounts by type
const cashTypes = ['checking', 'savings', 'cash', 'investment'];
const creditTypes = ['credit', 'line_of_credit'];

const cashBalance = accounts
  .filter(acc => cashTypes.includes(acc.type))
  .reduce((sum, acc) => sum + acc.currentBalance, 0);

const creditUsed = accounts
  .filter(acc => creditTypes.includes(acc.type))
  .reduce((sum, acc) => sum + Math.abs(acc.currentBalance), 0);

const totalCreditLimit = accounts
  .filter(acc => creditTypes.includes(acc.type))
  .reduce((sum, acc) => sum + (acc.creditLimit || 0), 0);

const availableCredit = totalCreditLimit - creditUsed;

// Update stats array
const stats: StatCardData[] = [
  {
    label: 'Cash Balance',
    value: `$${cashBalance.toFixed(2)}`,
    icon: <Wallet className="w-5 h-5" />,
    color: 'var(--color-income)',
    loading,
  },
  {
    label: 'Credit Used',
    value: `$${creditUsed.toFixed(2)}`,
    icon: <CreditCard className="w-5 h-5" />,
    color: 'var(--color-expense)',
    loading,
    tooltip: `Available: $${availableCredit.toFixed(2)} of $${totalCreditLimit.toFixed(2)}`,
  },
  // ... rest of stats
];
```

---

## Task 4.5: Utilization Trends Chart

### Current State
- CreditUtilizationWidget shows current utilization
- No historical trend data

### Target State
- Line chart showing utilization % over time
- Data from `account_balance_history` table
- Toggle between 30/60/90 days
- Aggregate or per-account view

### Implementation

#### 4.5.1 Create API for Utilization History

**File:** `app/api/accounts/utilization-history/route.ts`

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');
  const accountId = searchParams.get('accountId'); // optional

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const history = await db.select()
    .from(accountBalanceHistory)
    .where(and(
      eq(accountBalanceHistory.householdId, householdId),
      gte(accountBalanceHistory.snapshotDate, startDate.toISOString()),
      accountId ? eq(accountBalanceHistory.accountId, accountId) : undefined
    ))
    .orderBy(accountBalanceHistory.snapshotDate);

  return Response.json({ history });
}
```

#### 4.5.2 Create UtilizationTrendsChart Component

**File:** `components/charts/utilization-trends-chart.tsx`

Using Recharts:
- Line chart with date on X-axis, utilization % on Y-axis
- Color zones (green 0-30%, yellow 30-50%, orange 50-80%, red 80%+)
- Hover tooltip with exact values
- Time range selector

---

## Task 4.6: Balance History Chart

### Current State
- No balance history visualization

### Target State
- Area chart showing balance over time for credit accounts
- Stacked view for multiple accounts
- Individual account drill-down

### Implementation

#### 4.6.1 Create BalanceHistoryChart Component

**File:** `components/charts/balance-history-chart.tsx`

Using Recharts:
- Stacked area chart
- Color-coded by account
- Toggle between stacked/individual view
- Click to filter to single account

---

## Task 4.7: Strategy Inclusion Status

### Current State
- No visual indicator if debt is included in payoff strategy

### Target State
- Badge/icon on debt cards indicating strategy inclusion
- Toggle button to include/exclude from strategy
- Excluded debts visually de-emphasized

### Implementation

#### 4.7.1 Add Strategy Badge to Cards

Both `AccountCard` and `UnifiedDebtCard`:

```tsx
{includeInPayoffStrategy ? (
  <Badge variant="outline" className="text-[var(--color-success)]">
    <Target className="w-3 h-3 mr-1" />
    In Strategy
  </Badge>
) : (
  <Badge variant="outline" className="text-muted-foreground opacity-50">
    <Target className="w-3 h-3 mr-1" />
    Excluded
  </Badge>
)}
```

---

## Task 4.8: Overpayment/Credit Balance Display

### Current State
- Negative balances on credit cards not handled specially

### Target State
- Credit balance (overpayment) shown in green
- "Credit Balance" label instead of "Balance Owed"
- Available credit calculation adjusted

### Implementation

#### 4.8.1 Update AccountCard Logic

```typescript
const isCreditAccount = account.type === 'credit' || account.type === 'line_of_credit';
const balance = account.currentBalance;
const hasCredit = isCreditAccount && balance < 0; // Negative = credit/overpayment

// Display
{isCreditAccount && (
  <div>
    <p className="text-muted-foreground text-xs mb-1">
      {hasCredit ? 'Credit Balance' : 'Balance Owed'}
    </p>
    <p className={`text-2xl font-bold ${hasCredit ? 'text-[var(--color-income)]' : 'text-[var(--color-error)]'}`}>
      ${Math.abs(balance).toFixed(2)}
    </p>
  </div>
)}
```

---

## Implementation Order

### Day 1: Core Display Updates
1. **Task 4.1:** Accounts page grouping (3-4 hours)
2. **Task 4.2:** Available credit display enhancements (2-3 hours)
3. **Task 4.4:** Dashboard cash vs credit separation (2-3 hours)

### Day 2: Unified Debts & Charts
4. **Task 4.3:** Unified debts page (4-5 hours)
5. **Task 4.5:** Utilization trends chart (3-4 hours)

### Day 3: Finishing Touches
6. **Task 4.6:** Balance history chart (3-4 hours)
7. **Task 4.7:** Strategy inclusion status (1-2 hours)
8. **Task 4.8:** Overpayment handling (1-2 hours)

---

## Testing Checklist

### Accounts Page
- [ ] Cash accounts grouped separately from credit accounts
- [ ] Section headers show correct totals
- [ ] Empty sections hidden
- [ ] Line of credit accounts show draw period info
- [ ] Credit cards show utilization bar

### Debts Page
- [ ] Credit card balances appear in debt list
- [ ] Debt bills appear in debt list
- [ ] Filter tabs work correctly
- [ ] Strategy inclusion toggle works
- [ ] Payoff calculations include all debt sources

### Dashboard
- [ ] Cash Balance shows only cash/debit accounts
- [ ] Credit Used shows credit account balances
- [ ] Tooltip shows available credit
- [ ] Stats update on data changes

### Charts
- [ ] Utilization chart loads historical data
- [ ] Balance history chart renders correctly
- [ ] Time range selector works
- [ ] Charts handle empty data gracefully

### Edge Cases
- [ ] Overpayment on credit card (negative balance)
- [ ] Zero credit limit accounts
- [ ] Accounts with no balance history
- [ ] Debts excluded from strategy

---

## API Endpoints Created

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/debts/unified` | GET | Combined credit accounts + debt bills |
| `/api/accounts/utilization-history` | GET | Historical utilization data |
| `/api/accounts/balance-history` | GET | Historical balance data |

---

## Components Created/Modified

| Component | Action | Description |
|-----------|--------|-------------|
| `AccountGroupSection` | Create | Section wrapper with header/totals |
| `UnifiedDebtCard` | Create | Versatile debt card for all types |
| `UtilizationTrendsChart` | Create | Line chart for utilization history |
| `BalanceHistoryChart` | Create | Area chart for balance history |
| `AccountCard` | Modify | Add LOC fields, overpayment handling |
| `CompactStatsBar` | Modify | Split cash vs credit stats |
| `DebtsPage` | Modify | Integrate unified debt view |
| `AccountsPage` | Modify | Add grouping by account type |

---

## Notes

- All monetary values use Decimal.js for calculations
- All colors use semantic CSS variables
- Charts use Recharts (already a dependency)
- Historical data requires balance snapshot cron job (separate task)
- Balance history table populated by Phase 1 migration


