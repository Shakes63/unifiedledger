# Unified Debt, Bill & Credit Card Architecture

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1.1 | Accounts Enhancement (Credit Cards & Lines of Credit) | COMPLETED 2025-12-03 |
| 1.2 | Bills Enhancement (Debt Extension & Autopay) | COMPLETED 2025-12-03 |
| 1.3 | Bill Instances & Payments | COMPLETED 2025-12-03 |
| 1.4 | Categories & Household Settings | COMPLETED 2025-12-03 |
| 1.5 | Transactions Enhancement | COMPLETED 2025-12-03 |
| 2 | Account Creation Flow | COMPLETED 2025-12-03 |
| 3 | Bill Form Updates | COMPLETED 2025-12-03 |
| 4 | Display Updates | COMPLETED 2025-12-03 |
| 5 | Transaction Flow Updates | COMPLETED 2025-12-04 |
| 6 | Autopay System | COMPLETED 2025-12-04 |
| 7 | Budget Integration | COMPLETED 2025-12-04 |
| 8 | Payoff Strategy & Per-Debt Inclusion | COMPLETED 2025-12-04 |
| 9 | Calendar Integration | COMPLETED 2025-12-04 |
| 10 | Notifications | COMPLETED 2025-12-04 |
| 11 | Tax Integration | COMPLETED 2025-12-04 |
| 12 | CSV Import Enhancements | COMPLETED 2025-12-04 |
| 13 | Dashboard Widgets | COMPLETED 2025-12-04 |
| 14 | Balance History & Trends | COMPLETED 2025-12-04 |
| 15 | Category Simplification | COMPLETED 2025-12-04 |
| 16 | Recurring Income | Not Started |
| 17 | Budget Rollover | Not Started |
| 18 | Savings-Goals Integration | Not Started |
| 19 | Bill Classification & Subscription Management | Not Started |

**Implementation Plans:**
- [Phase 1 Plan](./phase-1-schema-changes-plan.md)
- [Phase 5 Plan](./phase-5-transaction-flow-plan.md)
- [Phase 6 Plan](./phase-6-autopay-system-plan.md)
- [Phase 8 Plan](./phase-8-payoff-strategy-plan.md)

---

## Overview

This document outlines a simplified financial architecture that unifies debts, bills, and credit cards into a more intuitive model. The goal is to reduce redundancy, simplify user workflows, and provide clearer mental models for tracking financial obligations.

## Problem Statement

### Current Architecture Issues

The existing system has four separate entities with overlapping responsibilities:

1. **Debts** - Track balances, interest, payments
2. **Bills** - Track recurring payments, due dates, instances
3. **Categories** - Auto-created "Debt: X" categories for each debt
4. **Accounts** - Credit cards exist as accounts but debt tracking is separate

**Current workflow for a credit card:**
1. Create an account (type: credit)
2. Create a debt (type: credit_card) - duplicates info
3. Create a bill linked to the debt
4. All three entities have overlapping data (name, amount, category)

**Issues:**
- Redundant data entry
- Confusing relationships
- Credit cards are naturally accounts AND debts AND bills
- Users must understand when to create each entity type

---

## Proposed Architecture

### Core Insight: Two Types of Debts

| Type | Examples | Is an Account? | Has Transactions? |
|------|----------|----------------|-------------------|
| **Transactional Debt** | Credit Card, Line of Credit | Yes | Yes - purchases |
| **Fixed Debt** | Car Loan, Mortgage, Student Loan, Medical | No | No - just payments |

### Entity Model

```
┌─────────────────────────────────────────────────────────────┐
│                         ACCOUNTS                             │
│  (checking, savings, cash, investment, credit)              │
│                                                              │
│  Credit cards ARE accounts with built-in debt tracking      │
│  - Balance = amount owed                                    │
│  - Available = creditLimit - balance                        │
│  - Auto-generates payment bill if enabled                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ linkedAccountId
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          BILLS                               │
│  (with optional debt extension)                             │
│                                                              │
│  Regular bills: Utilities, subscriptions, rent              │
│  Debt bills: Car loan, mortgage, student loan, medical      │
│                                                              │
│  isDebt=true enables:                                       │
│  - Balance tracking                                         │
│  - Interest calculations                                    │
│  - Payoff projections                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ billId
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       TRANSACTIONS                           │
│                                                              │
│  Link to bill for payments                                  │
│  No separate debtId needed                                  │
└─────────────────────────────────────────────────────────────┘
```

### Entities Removed

- `debts` table → Merged into accounts (credit) and bills (isDebt=true)
- `debtPayments` table → Use billInstances instead
- `debtPayoffMilestones` table → Move to bills or create `billMilestones`
- `debtSettings` table → Move to user/household settings
- Auto-created "Debt: X" categories → User picks category on bill

---

## Credit Card Handling

### Balance Display Philosophy

Credit cards should answer two questions:
1. **"Can I afford this purchase?"** → Show Available Credit (Accounts view)
2. **"How much do I need to pay?"** → Show Amount Owed (Debts view)

### Balance Storage

```
Credit Limit:     $4,000
Amount Owed:      $100     (stored as currentBalance - positive number)
─────────────────────────────────────────────────────────────────────
Available Credit: $3,900   (computed: creditLimit - currentBalance)
```

**Storage approach:**
- `currentBalance` = amount owed (positive number)
- `creditLimit` = total credit line
- `availableCredit` = computed (creditLimit - currentBalance)

**Why store owed as positive?**
- Transactions are expenses (positive amounts)
- Buying $50 increases balance by $50
- Matches natural transaction flow
- No confusing negative math

### Display by View

| View | What to Show | Example |
|------|--------------|---------|
| **Accounts** | Available Credit | $3,900 |
| **Debts** | Amount Owed | $100 |
| **Net Worth** | Liability (negative) | -$100 |

### Transaction Behavior

| Action | Balance Change | Available | Owed |
|--------|----------------|-----------|------|
| Buy coffee ($5) | +$5 | $3,895 | $105 |
| Get refund ($20) | -$20 | $3,915 | $85 |
| Pay bill (transfer $50) | -$50 | $3,965 | $35 |
| Pay off completely | -$35 | $4,000 | $0 |

### Account Creation Flow

```
1. "Add Account" → Select "Credit Card"
2. Fill in: Name, Credit Limit, APR, Statement Day, Due Day
3. Toggle: "Set up monthly payment tracking" [ON by default]
4. Done!

Creates:
- Account (type: credit) with debt tracking fields
- Bill (linked to account, frequency: monthly) if toggle enabled
```

---

## Visual Distinction: Cash vs Credit

### The Problem

Combining real money with borrowing capacity is misleading. Users need to clearly distinguish:
- **Cash Assets** - Money you own (Checking, Savings, Cash, Investments)
- **Available Credit** - Borrowing capacity (Credit Cards, Lines of Credit)

### Account Grouping

```typescript
const CASH_ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'investment'];
const CREDIT_ACCOUNT_TYPES = ['credit'];
```

### Dashboard Display

```
┌─────────────────────────────────────────────────────┐
│                    Your Money                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  💰 Cash & Bank Accounts          $12,450           │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━                    │
│     Checking ············· $3,200                   │
│     Savings ·············· $8,500                   │
│     Cash ················· $750                     │
│                                                      │
│  💳 Available Credit              $7,900            │
│     ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  (dashed/muted)   │
│     Chase Sapphire ······· $3,900                   │
│     Amex Gold ············ $4,000                   │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Total Spending Power             $20,350           │
│  (Cash + Available Credit)                          │
└─────────────────────────────────────────────────────┘
```

### Visual Cues

| Element | Cash/Bank | Available Credit |
|---------|-----------|------------------|
| **Icon** | 💰 or 🏦 | 💳 |
| **Line style** | Solid | Dashed |
| **Color** | Primary/Green | Muted/Gray |
| **Font weight** | Bold | Regular |
| **Label** | "Cash & Bank" | "Available Credit" |
| **Opacity** | 100% | 70-80% |

### Net Worth Section

```
┌─────────────────────────────────────────────────────┐
│                    Net Worth                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Assets                          +$62,450           │
│     Cash & Bank ·········· $12,450                  │
│     Investments ·········· $50,000                  │
│                                                      │
│  Liabilities                     -$15,100           │
│     Credit Cards ········· $2,100                   │
│     Car Loan ············· $13,000                  │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Net Worth                       $47,350            │
└─────────────────────────────────────────────────────┘
```

### Account List with Grouping

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CASH & BANK ACCOUNTS         $12,450
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  🏦 Main Checking              $3,200
  🏦 Emergency Savings          $8,500
  💵 Wallet Cash                  $750

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  CREDIT CARDS                  $7,900
  Available Credit
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  
  💳 Chase Sapphire             $3,900
     $100 owed • 2.5% used
     
  💳 Amex Gold                  $4,000
     $0 owed • Paid off ✓
```

### CSS Implementation

```css
/* Cash/Bank accounts */
.account-group-cash {
  --group-color: var(--color-income);
  border-left: 3px solid var(--group-color);
}

.account-group-cash .total {
  font-weight: 600;
  color: var(--color-foreground);
}

/* Credit/Available */
.account-group-credit {
  --group-color: var(--color-muted-foreground);
  border-left: 3px dashed var(--group-color);
  opacity: 0.85;
}

.account-group-credit .total {
  font-weight: 400;
  color: var(--color-muted-foreground);
}
```

---

## Credit Card Features

### Credit Utilization Tracking

```
Available: $3,900
Owed: $100
Utilization: 2.5% ✓ Excellent
```

**Warning thresholds:**
- 0-10%: Excellent (green)
- 10-30%: Good (blue)
- 30-50%: Fair (yellow)
- 50-75%: Poor (orange)
- 75%+: Critical (red)

### Statement vs Current Balance

```
Statement Balance: $85     ← Pay this to avoid interest
Current Balance:   $120    ← Total owed (includes new charges)
Minimum Payment:   $25     ← Absolute minimum due
```

### Visual Account Card (Accounts Section)

```
┌─────────────────────────────────────┐
│ 💳 Chase Sapphire                   │
│                                     │
│     $3,900                          │
│     Available Credit                │
│                                     │
│ ████████████████████░░░░ 2.5%      │
│ $100 of $4,000 used                 │
│                                     │
│ Payment due: Dec 15 • Min: $25      │
└─────────────────────────────────────┘
```

### Visual Debt Card (Debts Section)

```
┌─────────────────────────────────────┐
│ 💳 Chase Sapphire           19.99%  │
│                                     │
│     $100                            │
│     Current Balance                 │
│                                     │
│ Statement: $85 • Due: Dec 15        │
│ Minimum: $25 • Utilization: 2.5%    │
│                                     │
│ [Pay Statement] [Pay in Full]       │
└─────────────────────────────────────┘
```

### Edge Cases

**Over-limit spending:**
- If currentBalance > creditLimit (fees, interest pushed over)
- Available shows: $0 (not negative)
- Owed shows actual amount
- Warning indicator displayed

**Credit balance (overpayment):**
- currentBalance can go negative (you overpaid)
- Available shows: creditLimit + overpayment amount
- Owed shows: $0 (or "Credit: $50")

---

## Schema Changes

### Accounts Table (Enhanced)

```typescript
accounts {
  // Existing fields
  id, name, currentBalance, ...
  
  // Updated type enum
  type: enum,                     // 'checking', 'savings', 'credit', 'line_of_credit', 'investment', 'cash'
  
  // Credit/Line of Credit fields (for type = 'credit' or 'line_of_credit')
  creditLimit: real,              // Total credit line
  
  // Statement tracking
  statementBalance: real,         // Last statement amount
  statementDate: text,            // When statement closed
  statementDueDate: text,         // Payment due date for this statement
  minimumPaymentAmount: real,     // Minimum payment on statement
  lastStatementUpdated: text,     // When user last updated statement info
  
  // Interest & payments
  interestRate: real,             // APR
  minimumPaymentPercent: real,    // e.g., 2% of balance
  minimumPaymentFloor: real,      // e.g., $25 minimum
  additionalMonthlyPayment: real, // Extra user commits to pay monthly
  
  // Line of credit specific
  isSecured: boolean,             // HELOC is secured by home
  securedAsset: text,             // Description of collateral
  drawPeriodEndDate: text,        // When draw period ends (HELOC)
  repaymentPeriodEndDate: text,   // When repayment period ends
  interestType: enum,             // 'fixed', 'variable'
  primeRateMargin: real,          // For variable: Prime + X%
  
  // Annual fee (for credit cards)
  annualFee: real,                // e.g., $95
  annualFeeMonth: integer,        // Month fee is charged (1-12)
  annualFeeBillId: text,          // Auto-created bill for the fee
  
  // Auto-bill creation
  autoCreatePaymentBill: boolean, // Create linked bill on account creation
  
  // Payoff strategy inclusion (for credit/line_of_credit)
  includeInPayoffStrategy: boolean,  // Default: true - exclude daily-use cards, 0% APR, etc.
}
```

### Bills Table (Enhanced with Debt Extension + Income + Savings)

```typescript
bills {
  // Existing fields
  id, name, expectedAmount, dueDate, frequency, categoryId, merchantId, ...
  
  // NEW: Bill direction/type
  billType: enum,                 // 'expense', 'income', 'savings_transfer'
  
  // NEW: Bill classification for filtering/views
  billClassification: enum,       // 'subscription', 'utility', 'housing', 'insurance', 'loan_payment', 'membership', 'service', 'other'
  classificationSubcategory: text, // User-defined: 'streaming', 'software', 'fitness', etc.
  
  // Link to account (for credit card payments)
  linkedAccountId: text,          // If set, this bill pays this account
  amountSource: enum,             // 'fixed', 'minimum_payment', 'statement_balance', 'full_balance'
  
  // For bills that charge TO a card (subscriptions)
  chargedToAccountId: text,       // Credit card this bill charges to
  
  // Autopay settings (available for ALL bills)
  isAutopayEnabled: boolean,
  autopayAccountId: text,         // Account to pull from
  autopayAmountType: enum,        // 'fixed', 'minimum_payment', 'statement_balance', 'full_balance'
  autopayFixedAmount: real,       // If autopayAmountType = 'fixed'
  autopayDaysBefore: integer,     // Days before due date to process (default: 0)
  
  // Debt extension fields (for non-account debts like loans)
  isDebt: boolean,                // Enables debt tracking mode
  originalBalance: real,          // Starting debt amount
  remainingBalance: real,         // Current owed
  interestRate: real,
  interestType: enum,             // 'fixed', 'variable', 'none'
  minimumPayment: real,
  additionalMonthlyPayment: real, // Extra user commits to pay monthly
  debtType: enum,                 // 'personal_loan', 'student_loan', 'mortgage', 'auto_loan', 'medical', 'other'
  color: text,                    // For UI display
  
  // Payment generation
  isActive: boolean,              // false = debt exists but no payments due (dormant)
  
  // Payoff strategy inclusion (for isDebt = true)
  includeInPayoffStrategy: boolean,  // Default: true - exclude 0% APR, mortgages, etc.
  
  // Tax deduction settings (for isDebt = true)
  isInterestTaxDeductible: boolean,  // Can deduct interest on taxes
  taxDeductionType: enum,            // 'mortgage', 'student_loan', 'business', 'heloc_home', 'none'
  taxDeductionLimit: real,           // Annual limit (e.g., $2,500 for student loans)
}
```

### NEW: Bill Payments Table (Payment History)

```typescript
billPayments {
  id: text,
  
  billId: text,                    // The bill being paid
  billInstanceId: text,            // Specific instance (if applicable)
  transactionId: text,             // The payment transaction
  
  userId: text,
  householdId: text,
  
  amount: real,                    // Payment amount
  principalAmount: real,           // For debts: amount toward principal
  interestAmount: real,            // For debts: amount toward interest
  
  paymentDate: text,
  paymentMethod: enum,             // 'manual', 'transfer', 'autopay'
  
  // For credit cards
  linkedAccountId: text,           // Credit card account paid
  balanceBeforePayment: real,      // Balance before this payment
  balanceAfterPayment: real,       // Balance after this payment
  
  notes: text,
  createdAt: text,
}
```

### NEW: Account Balance History Table (Utilization Trends)

```typescript
accountBalanceHistory {
  id: text,
  accountId: text,
  userId: text,
  householdId: text,
  
  snapshotDate: text,             // Date of snapshot (daily)
  balance: real,                  // Balance on this date
  
  // For credit accounts
  creditLimit: real,              // Limit at time of snapshot
  availableCredit: real,          // Available at time of snapshot
  utilizationPercent: real,       // Computed utilization
  
  createdAt: text,
}
```

### NEW: Bill Milestones Table

```typescript
billMilestones {
  id: text,
  billId: text,                   // For debt bills
  accountId: text,                // For credit accounts
  userId: text,
  householdId: text,
  
  percentage: integer,            // 25, 50, 75, 100
  milestoneBalance: real,         // Balance at which milestone hits
  achievedAt: text,               // When achieved
  notificationSentAt: text,       // When user was notified
  
  createdAt: text,
}
```

### NEW: Credit Limit History Table

```typescript
creditLimitHistory {
  id: text,
  accountId: text,
  userId: text,
  householdId: text,
  
  previousLimit: real,
  newLimit: real,
  changeDate: text,
  changeReason: enum,             // 'user_update', 'bank_increase', 'bank_decrease'
  
  // Impact on utilization
  utilizationBefore: real,        // % before change
  utilizationAfter: real,         // % after change
  
  createdAt: text,
}
```

### Budget Categories Table (Simplified Types + Rollover)

```typescript
budgetCategories {
  id: text,
  userId: text,
  householdId: text,
  name: text,
  
  // SIMPLIFIED: Only 3 types now
  type: enum,                     // 'income', 'expense', 'savings'
  
  monthlyBudget: real,
  isActive: boolean,
  isTaxDeductible: boolean,
  isBusinessCategory: boolean,
  sortOrder: integer,
  usageCount: integer,
  lastUsedAt: text,
  
  // NEW: System category flags
  isSystemCategory: boolean,      // Cannot be deleted/renamed by user
  isInterestCategory: boolean,    // Flag for interest charge tracking
  
  // NEW: Budget rollover
  rolloverEnabled: boolean,       // Unused budget rolls to next month
  rolloverBalance: real,          // Accumulated rollover from previous months
  rolloverLimit: real,            // Max rollover allowed (null = unlimited)
  
  createdAt: text,
}
```

**Category Type Migration:**
| Old Type | New Type |
|----------|----------|
| `income` | `income` |
| `variable_expense` | `expense` |
| `monthly_bill` | `expense` |
| `non_monthly_bill` | `expense` |
| `debt` | `expense` (or user's choice) |
| `savings` | `savings` |

### Household Settings (Add Payoff Settings)

```typescript
householdSettings {
  // ... existing fields ...
  
  // Debt payoff strategy (moved from debtSettings)
  debtStrategyEnabled: boolean,   // Master toggle: true = strategy mode, false = manual
  debtPayoffMethod: enum,         // 'snowball', 'avalanche' (only when enabled)
  extraMonthlyPayment: real,      // Extra amount to put toward debt (only when enabled)
  paymentFrequency: enum,         // 'weekly', 'biweekly', 'monthly'
}
```

### Tables to Remove

- `debts` - Merged into accounts (credit/line_of_credit) and bills (isDebt=true)
- `debtPayments` - Replaced by `billPayments`
- `debtPayoffMilestones` - Replaced by `billMilestones`
- `debtSettings` - Moved to `householdSettings`

### Transactions Table (Simplified)

```typescript
transactions {
  // Remove debtId - use billId instead
  // debtId: text,  // REMOVED
  
  // Keep billId for linking payments
  billId: text,
  
  // NEW: Flag for interest charges
  isInterestCharge: boolean,      // Alternative to category-only approach
  
  // NEW: Tax deduction tracking
  isTaxDeductible: boolean,       // Inherited from bill's tax settings
  taxDeductionType: enum,         // 'mortgage', 'student_loan', 'business', 'none'
  
  // NEW: Savings goal linking
  savingsGoalId: text,            // Optional link to specific savings goal
}
```

### Import Templates Table (Enhanced for Credit Cards)

```typescript
importTemplates {
  // ... existing fields ...
  
  // Credit card specific
  isCreditCardTemplate: boolean,
  paymentDetectionPatterns: text,     // JSON: ["PAYMENT", "THANK YOU", ...]
  interestDetectionPatterns: text,    // JSON: ["INTEREST", "FINANCE CHARGE", ...]
  feeDetectionPatterns: text,         // JSON: ["FEE", "ANNUAL FEE", ...]
  refundDetectionPatterns: text,      // JSON: ["REFUND", "CREDIT", ...]
  skipPaymentTransactions: boolean,   // Auto-skip payments (handle via checking import)
  captureStatementInfo: boolean,      // Prompt for statement details
}
```

### Bill Instances Table (Enhanced)

```typescript
billInstances {
  // ... existing fields ...
  
  // NEW: Partial payment support
  status: enum,                   // 'pending', 'paid', 'partial', 'overdue', 'skipped'
  shortfallAmount: real,          // If partial: how much short of minimum
}
```

---

## User Workflows

### Creating a Credit Card

```
1. "Add Account" → Select "Credit Card"
2. Fill in:
   - Name: "Chase Sapphire"
   - Credit Limit: $4,000
   - APR: 19.99%
   - Statement Day: 15
   - Payment Due Day: 10
3. Toggle: "Set up monthly payment tracking" [ON by default]
4. Click Save

Creates:
- Account (type: credit) with all credit card fields
- Bill (linkedAccountId set, frequency: monthly) if toggle enabled
```

### Creating a Car Loan / Mortgage / Student Loan

```
1. "Add Bill" → Toggle "This is a debt I'm paying off" [ON]
2. Fill in:
   - Name: "Honda Civic Loan"
   - Payment Amount: $350
   - Due Day: 5
   - Frequency: Monthly
3. Debt fields appear:
   - Original Balance: $18,000
   - Remaining Balance: $13,000
   - APR: 4.5%
   - Debt Type: Auto Loan
4. Click Save

Creates:
- Bill with isDebt=true and all debt tracking fields
- Bill instances generated for upcoming payments
```

### Creating a Debt You're NOT Paying Yet

```
1. "Add Bill" → Toggle "This is a debt I'm paying off" [ON]
2. Toggle "Currently making payments" [OFF]
3. Fill in balance and interest info
4. Click Save

Creates:
- Bill with isDebt=true and isActive=false
- No bill instances generated
- Balance tracked for reference
- Can activate later when payments start
```

### Creating a Regular Bill (Netflix, Electric)

```
1. "Add Bill" → Leave "This is a debt" [OFF]
2. Fill in: Name, Amount, Due Day, Frequency, Category
3. Click Save

Creates:
- Normal bill with bill instances
```

### Making a Credit Card Payment

```
1. Create transfer: Checking → Chase Sapphire
2. System detects:
   - Target account is credit card
   - Has linked payment bill
3. Automatically:
   - Reduces credit card balance (more available)
   - Marks bill instance as paid (if matches)
```

### Making a Loan Payment

```
1. Create expense transaction
2. Select bill: "Honda Civic Loan"
3. System automatically:
   - Marks bill instance as paid
   - Reduces remaining balance on bill
   - Updates payoff projections
```

---

## Credit Card Payment Flow (Transfers)

### How Credit Card Payments Work

When a user creates a transfer from a bank account to a credit card:

```
Transfer: Checking ($5,000) → Chase Sapphire (owes $500)
Amount: $200
```

**System Actions:**
1. Decrease Checking balance by $200
2. Decrease Chase Sapphire owed by $200 (available increases)
3. Find linked payment bill for Chase Sapphire
4. Mark matching bill instance as paid
5. Create payment history record for reporting

### Payment History Table

A new `billPayments` table tracks all payments for reporting and history:

```typescript
billPayments {
  id: text,
  
  billId: text,                    // The bill being paid
  billInstanceId: text,            // Specific instance (if applicable)
  transactionId: text,             // The payment transaction
  
  userId: text,
  householdId: text,
  
  amount: real,                    // Payment amount
  principalAmount: real,           // For debts: amount toward principal
  interestAmount: real,            // For debts: amount toward interest
  
  paymentDate: text,
  paymentMethod: enum,             // 'manual', 'transfer', 'autopay'
  
  // For credit cards
  linkedAccountId: text,           // Credit card account paid
  balanceBeforePayment: real,      // Balance before this payment
  balanceAfterPayment: real,       // Balance after this payment
  
  notes: text,
  createdAt: text,
}
```

### Payment Detection Logic

```typescript
// When creating a transfer
if (toAccount.type === 'credit') {
  // This is a credit card payment
  const linkedBill = await findBillLinkedToAccount(toAccount.id);
  
  if (linkedBill) {
    // Find oldest unpaid instance
    const unpaidInstance = await findOldestUnpaidInstance(linkedBill.id);
    
    if (unpaidInstance) {
      // Mark as paid
      await markInstancePaid(unpaidInstance.id, transfer.amount);
    }
    
    // Record payment history
    await createPaymentHistory({
      billId: linkedBill.id,
      billInstanceId: unpaidInstance?.id,
      transactionId: transferOutTransaction.id,
      amount: transfer.amount,
      linkedAccountId: toAccount.id,
      balanceBeforePayment: toAccount.currentBalance,
      balanceAfterPayment: toAccount.currentBalance - transfer.amount,
      paymentMethod: 'transfer',
    });
  }
  
  // Update credit card balance
  await updateAccountBalance(toAccount.id, -transfer.amount);
}
```

---

## Autopay System

### Overview

Autopay is available for ALL bills (not just credit cards). When enabled, the system automatically creates transactions on the due date.

### Bill Autopay Fields

```typescript
bills {
  // ... existing fields ...
  
  // Autopay settings
  isAutopayEnabled: boolean,
  autopayAccountId: text,           // Account to pull from
  autopayAmountType: enum,          // 'fixed', 'minimum_payment', 'statement_balance', 'full_balance'
  autopayFixedAmount: real,         // If autopayAmountType = 'fixed'
  autopayDaysBefore: integer,       // Days before due date to process (default: 0)
}
```

### Autopay Transaction Creation

When autopay is enabled, the system creates transactions automatically:

**Daily Cron Job:**
```typescript
async function processAutopayBills() {
  const today = new Date();
  
  // Find bill instances due for autopay
  const instances = await db
    .select()
    .from(billInstances)
    .innerJoin(bills, eq(billInstances.billId, bills.id))
    .where(
      and(
        eq(bills.isAutopayEnabled, true),
        eq(billInstances.status, 'pending'),
        lte(billInstances.dueDate, addDays(today, bills.autopayDaysBefore))
      )
    );
  
  for (const instance of instances) {
    const amount = calculateAutopayAmount(instance.bill, instance);
    
    // Create the payment transaction
    if (instance.bill.linkedAccountId) {
      // Credit card - create transfer
      await createTransfer({
        fromAccountId: instance.bill.autopayAccountId,
        toAccountId: instance.bill.linkedAccountId,
        amount,
        description: `Autopay: ${instance.bill.name}`,
      });
    } else {
      // Regular bill or loan - create expense
      await createTransaction({
        accountId: instance.bill.autopayAccountId,
        amount,
        type: 'expense',
        description: `Autopay: ${instance.bill.name}`,
        billId: instance.bill.id,
        categoryId: instance.bill.categoryId,
      });
    }
    
    // Mark instance as paid
    await markInstancePaid(instance.id, amount);
    
    // Record in payment history
    await createPaymentHistory({
      billId: instance.bill.id,
      billInstanceId: instance.id,
      amount,
      paymentMethod: 'autopay',
    });
  }
}
```

### Autopay UI

**Bill Form - Autopay Section:**
```
┌─────────────────────────────────────────────────────┐
│  Autopay Settings                                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [✓] Enable Autopay                                 │
│                                                      │
│  Pay from: [Main Checking ▼]                        │
│                                                      │
│  Amount:   ○ Fixed amount: $______                  │
│            ○ Minimum payment                        │
│            ● Statement balance                      │
│            ○ Full balance                           │
│                                                      │
│  Process:  [0 ▼] days before due date              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Autopay Notifications

- Suppress "payment due" reminders for bills with autopay enabled
- Send "Autopay processed" notification after transaction created
- Send "Autopay failed" notification if insufficient funds

---

## Statement Balance Updates

### How Statement Balances Get Updated

Statement balances for credit cards are updated via:

1. **Manual Entry** - User enters statement balance after receiving statement
2. **CSV Import** - Import credit card statement CSV which includes statement balance

### Statement Update Flow

**Manual:**
```
1. User goes to Account Details for credit card
2. Clicks "Update Statement"
3. Enters:
   - Statement Date: Dec 15, 2024
   - Statement Balance: $847.52
   - Minimum Payment: $25.00
   - Payment Due Date: Jan 10, 2025
4. System updates account fields
```

**CSV Import:**
- When importing transactions for a credit card
- Option to capture statement info from CSV headers/footers
- Auto-populate statement fields

### Statement Fields on Account

```typescript
accounts {
  // Statement tracking (for credit cards)
  statementBalance: real,         // Amount on last statement
  statementDate: text,            // Date statement closed
  statementDueDate: text,         // Payment due date for this statement
  minimumPaymentAmount: real,     // Minimum payment on statement
  lastStatementUpdated: text,     // When user last updated statement info
}
```

---

## Interest Tracking

### Approach: Interest Category

Interest charges are tracked using a dedicated **system category** rather than tags:

```typescript
// System-created category (one per household)
budgetCategories {
  id: 'system-interest-charges',
  name: 'Interest Charges',
  type: 'variable_expense',
  isSystemCategory: boolean,      // NEW: Cannot be deleted/renamed
  isInterestCategory: boolean,    // NEW: Flag for interest tracking
}
```

### Why Category Instead of Tag?

1. **Budget tracking** - Interest charges count against budget
2. **Reports** - Shows in expense breakdown by category
3. **Tax implications** - Some interest (mortgage) is deductible
4. **Automatic categorization** - Rules can auto-categorize interest charges

### Interest Transaction Flow

When importing or creating an interest charge:

```
1. Transaction: "INTEREST CHARGE" - $15.42
2. System suggests category: "Interest Charges"
3. User confirms
4. Transaction linked to the credit card bill (if identifiable)
```

### Interest Reports

**Report: Interest Paid**
```
┌─────────────────────────────────────────────────────┐
│  Interest Paid - 2024                                │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Total Interest Paid:              $847.23          │
│                                                      │
│  By Account:                                         │
│    Chase Sapphire ············· $423.12             │
│    Amex Gold ················· $198.45              │
│    Car Loan ·················· $225.66              │
│                                                      │
│  By Month:                                          │
│    [Chart showing monthly interest paid]            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Interest Auto-Detection

Categorization rules can auto-detect interest charges:

```typescript
// Auto-create rule for interest detection
{
  name: 'Auto-categorize Interest Charges',
  conditions: [
    { field: 'description', operator: 'contains', value: 'INTEREST' },
    { field: 'description', operator: 'contains', value: 'FINANCE CHARGE' },
  ],
  actions: [
    { type: 'set_category', value: 'system-interest-charges' },
  ],
}
```

---

## Line of Credit Accounts

### Account Type: line_of_credit

Lines of credit (HELOC, personal line of credit) are similar to credit cards but with differences:

```typescript
accounts {
  type: enum, // Add 'line_of_credit' to existing types
  
  // Shared with credit cards
  creditLimit: real,
  currentBalance: real,           // Amount owed
  interestRate: real,
  
  // Line of credit specific
  isSecured: boolean,             // HELOC is secured by home
  securedAsset: text,             // Description of collateral
  drawPeriodEndDate: text,        // When draw period ends (HELOC)
  repaymentPeriodEndDate: text,   // When repayment period ends
  
  // Interest calculation
  interestType: enum,             // 'fixed', 'variable'
  primeRateMargin: real,          // For variable: Prime + X%
}
```

### Display Grouping

```typescript
const CREDIT_ACCOUNT_TYPES = ['credit', 'line_of_credit'];

// Both show in "Available Credit" section
// Both show in "Liabilities" for net worth
```

### Line of Credit vs Credit Card Differences

| Feature | Credit Card | Line of Credit |
|---------|-------------|----------------|
| Draw period | Ongoing | May have end date |
| Interest rate | Usually fixed APR | Often variable (Prime + X) |
| Minimum payment | % of balance or floor | May be interest-only in draw |
| Annual fee | Common | Less common |
| Secured | No | Sometimes (HELOC) |
| Rewards | Yes | No |

---

## Recurring Charges on Credit Cards

### Bills That Auto-Charge to a Credit Card

Some bills (subscriptions) automatically charge to a credit card rather than pulling from a bank account.

### Bill Configuration

```typescript
bills {
  // ... existing fields ...
  
  // For bills that charge TO a card
  chargedToAccountId: text,       // Credit card this bill charges to
}
```

### Workflow

**Creating a subscription that charges to credit card:**
```
1. "Add Bill" 
2. Name: "Netflix"
3. Amount: $15.99
4. Frequency: Monthly
5. Toggle: "This bill charges to a credit card" [ON]
6. Select card: [Chase Sapphire ▼]
7. Save

Bill created with chargedToAccountId = Chase Sapphire
```

### Transaction Matching

When a Netflix charge appears on Chase Sapphire:
1. Transaction imports/created on credit card
2. System looks for bills where `chargedToAccountId = thisAccount`
3. Matches by amount, date proximity, and description patterns
4. Auto-links transaction to Netflix bill
5. Marks bill instance as paid

### Visual Display

**Bill Card:**
```
┌─────────────────────────────────────┐
│ Netflix                    $15.99   │
│ Monthly • Due 15th                  │
│                                     │
│ 💳 Charges to: Chase Sapphire      │
│                                     │
│ [Mark Paid] [Skip]                  │
└─────────────────────────────────────┘
```

---

## Balance History & Utilization Trends

### Balance Snapshots Table

Track account balances over time for trending:

```typescript
accountBalanceHistory {
  id: text,
  accountId: text,
  userId: text,
  householdId: text,
  
  snapshotDate: text,             // Date of snapshot (usually daily)
  balance: real,                  // Balance on this date
  
  // For credit accounts
  creditLimit: real,              // Limit at time of snapshot
  availableCredit: real,          // Available at time of snapshot
  utilizationPercent: real,       // Computed utilization
  
  createdAt: text,
}
```

### Snapshot Collection

**Daily Cron Job:**
```typescript
async function captureBalanceSnapshots() {
  const accounts = await db.select().from(accounts).where(eq(accounts.isActive, true));
  
  for (const account of accounts) {
    await db.insert(accountBalanceHistory).values({
      id: nanoid(),
      accountId: account.id,
      userId: account.userId,
      householdId: account.householdId,
      snapshotDate: new Date().toISOString().split('T')[0],
      balance: account.currentBalance,
      creditLimit: account.creditLimit,
      availableCredit: account.creditLimit ? account.creditLimit - account.currentBalance : null,
      utilizationPercent: account.creditLimit ? (account.currentBalance / account.creditLimit) * 100 : null,
    });
  }
}
```

### Utilization Trend Chart

```
┌─────────────────────────────────────────────────────┐
│  Credit Utilization - Last 6 Months                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  100% ┤                                             │
│   75% ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (danger)      │
│   50% ┤               ╭─╮                           │
│   30% ┤ ─ ─ ─ ─ ─ ─ ─│─│─ ─ ─ ─ ─ ─ (warning)     │
│   25% ┤    ╭───╮     │ │    ╭──╮                   │
│   10% ┤────╯   ╰─────╯ ╰────╯  ╰────● 12%         │
│    0% ┼────┬────┬────┬────┬────┬────┬              │
│        Jul  Aug  Sep  Oct  Nov  Dec                 │
│                                                      │
│  Average: 18% • Current: 12% • Trend: ↓ Improving  │
└─────────────────────────────────────────────────────┘
```

### Balance Over Time Chart

```
┌─────────────────────────────────────────────────────┐
│  Chase Sapphire Balance - Last 12 Months            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  $2000 ┤         ╭─╮                                │
│  $1500 ┤    ╭───╮│ │    ╭──╮                       │
│  $1000 ┤───╮│   ││ │╭───│  │                       │
│   $500 ┤   ╰╯   ╰╯ ╰╯   ╰──╰────● $450            │
│     $0 ┼────┬────┬────┬────┬────┬────┬            │
│         Jan  Mar  May  Jul  Sep  Nov               │
│                                                      │
│  Highest: $1,847 (Feb) • Current: $450             │
└─────────────────────────────────────────────────────┘
```

---

## Debt Payoff Strategy Integration

### Sources of Debt

The payoff strategy calculations now pull from:

1. **Credit card accounts** (`accounts.type = 'credit'`)
2. **Line of credit accounts** (`accounts.type = 'line_of_credit'`)
3. **Debt bills** (`bills.isDebt = true`)

### Unified Debt List

```typescript
interface DebtItem {
  id: string;
  name: string;
  source: 'account' | 'bill';          // Where this debt comes from
  sourceId: string;                     // Account ID or Bill ID
  
  remainingBalance: number;
  interestRate: number;
  minimumPayment: number;
  additionalPayment: number;            // Extra user commits to pay
  
  // For display
  type: string;                         // 'credit_card', 'auto_loan', etc.
  color: string;
  icon: string;
}

async function getAllDebts(userId: string, householdId: string): Promise<DebtItem[]> {
  // Get credit accounts
  const creditAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId),
        inArray(accounts.type, ['credit', 'line_of_credit']),
        gt(accounts.currentBalance, 0)  // Has balance owed
      )
    );
  
  // Get debt bills
  const debtBills = await db
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.userId, userId),
        eq(bills.householdId, householdId),
        eq(bills.isDebt, true),
        gt(bills.remainingBalance, 0)   // Has balance remaining
      )
    );
  
  return [
    ...creditAccounts.map(a => ({
      id: `account-${a.id}`,
      name: a.name,
      source: 'account' as const,
      sourceId: a.id,
      remainingBalance: a.currentBalance,
      interestRate: a.interestRate || 0,
      minimumPayment: calculateMinimumPayment(a),
      additionalPayment: a.additionalMonthlyPayment || 0,
      type: a.type === 'credit' ? 'credit_card' : 'line_of_credit',
      color: a.color || '#ef4444',
      icon: 'credit-card',
    })),
    ...debtBills.map(b => ({
      id: `bill-${b.id}`,
      name: b.name,
      source: 'bill' as const,
      sourceId: b.id,
      remainingBalance: b.remainingBalance,
      interestRate: b.interestRate || 0,
      minimumPayment: b.minimumPayment || 0,
      additionalPayment: b.additionalMonthlyPayment || 0,
      type: b.debtType || 'other',
      color: b.color || '#ef4444',
      icon: getDebtIcon(b.debtType),
    })),
  ];
}
```

### Payoff Settings

Move debt payoff settings to household settings:

```typescript
householdSettings {
  // ... existing fields ...
  
  // Debt payoff strategy
  debtPayoffMethod: enum,             // 'snowball', 'avalanche'
  extraMonthlyPayment: real,          // Extra amount to put toward debt
  paymentFrequency: enum,             // 'weekly', 'biweekly', 'monthly'
}
```

### Milestones on Bills

```typescript
billMilestones {
  id: text,
  billId: text,                       // For debt bills
  accountId: text,                    // For credit accounts
  userId: text,
  householdId: text,
  
  percentage: integer,                // 25, 50, 75, 100
  milestoneBalance: real,             // Balance at which milestone hits
  achievedAt: text,                   // When achieved
  notificationSentAt: text,           // When user was notified
  
  createdAt: text,
}
```

---

## Annual Fee Auto-Bills

### Credit Card Annual Fee Tracking

When creating a credit card with an annual fee, automatically create a linked annual bill.

### Account Fields

```typescript
accounts {
  // ... existing fields ...
  
  // Annual fee (for credit cards)
  annualFee: real,                    // e.g., $95
  annualFeeMonth: integer,            // Month fee is charged (1-12)
  annualFeeBillId: text,              // Auto-created bill for the fee
}
```

### Auto-Creation Flow

```typescript
async function createCreditCardAccount(data) {
  // Create the account
  const account = await db.insert(accounts).values({
    ...data,
    type: 'credit',
  });
  
  // If has annual fee, create the bill
  if (data.annualFee && data.annualFee > 0) {
    const annualFeeBill = await db.insert(bills).values({
      id: nanoid(),
      userId: data.userId,
      householdId: data.householdId,
      name: `${data.name} Annual Fee`,
      expectedAmount: data.annualFee,
      dueDate: 15,                    // Mid-month default
      frequency: 'annual',
      startMonth: data.annualFeeMonth - 1,  // 0-indexed
      linkedAccountId: account.id,
      chargedToAccountId: account.id,  // Charges TO the card itself
      isActive: true,
      categoryId: null,               // User can set category
      notes: `Annual fee for ${data.name} credit card`,
    });
    
    // Link back to account
    await db.update(accounts)
      .set({ annualFeeBillId: annualFeeBill.id })
      .where(eq(accounts.id, account.id));
  }
  
  return account;
}
```

### Annual Fee Display

**Account Details:**
```
┌─────────────────────────────────────────────────────┐
│  Chase Sapphire                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Credit Limit: $4,000                               │
│  APR: 19.99%                                        │
│  Annual Fee: $95 (charged in January)               │
│                                                      │
│  ⓘ Annual fee bill automatically created            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Bills List - Annual Fee Bill:**
```
┌─────────────────────────────────────┐
│ Chase Sapphire Annual Fee   $95.00  │
│ Annual • Due Jan 15                 │
│                                     │
│ 💳 Charges to: Chase Sapphire      │
│ 🔗 Linked to account               │
│                                     │
│ Next due: Jan 15, 2025 (43 days)   │
└─────────────────────────────────────┘
```

---

## Calendar Integration

### Bill Due Dates

All bills (including credit card payment bills) display on the calendar:

```
┌─────────────────────────────────────────────────────┐
│  December 2024                                       │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────┤
│ Sun  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────┤
│      │      │      │      │      │      │          │
│  1   │  2   │  3   │  4   │  5   │  6   │  7       │
│      │      │      │      │ 🚗   │      │          │
│      │      │      │      │ Car  │      │          │
│      │      │      │      │ Loan │      │          │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────┤
│  8   │  9   │  10  │  11  │  12  │  13  │  14      │
│      │      │ 💳   │      │      │      │          │
│      │      │Chase │      │      │      │          │
│      │      │ Due  │      │      │      │          │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────┤
│ 15   │ 16   │  17  │  18  │  19  │  20  │  21      │
│ ⚡   │      │      │      │      │ 🎓   │          │
│Elect │      │      │      │      │Stud. │          │
│      │      │      │      │      │Loan  │          │
└──────┴──────┴──────┴──────┴──────┴──────┴──────────┘
```

### Autopay Dates

When autopay is enabled, show when it will process:

```
Calendar Day View - December 8:

┌─────────────────────────────────────────────────────┐
│  December 8, 2024                                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🔄 AUTOPAY PROCESSING                              │
│                                                      │
│  💳 Chase Sapphire - $847.52                        │
│     Autopay: Statement Balance                       │
│     From: Main Checking                              │
│     Status: Scheduled                                │
│                                                      │
│  ⚡ Electric Bill - $142.00                         │
│     Autopay: Fixed Amount                            │
│     From: Main Checking                              │
│     Status: Scheduled                                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Projected Payoff Dates

Debt bills and credit cards show projected payoff on calendar:

```
Calendar - August 2025:

┌──────┬──────┬──────┬──────┬──────┬──────┬──────────┤
│ 17   │ 18   │  19  │  20  │  21  │  22  │  23      │
│      │      │      │ 🎉   │      │      │          │
│      │      │      │Chase │      │      │          │
│      │      │      │PAYOFF│      │      │          │
└──────┴──────┴──────┴──────┴──────┴──────┴──────────┘

Day View - August 20, 2025:

┌─────────────────────────────────────────────────────┐
│  🎉 PROJECTED DEBT PAYOFF                           │
├─────────────────────────────────────────────────────┤
│                                                      │
│  💳 Chase Sapphire                                  │
│     Projected payoff date (based on current plan)   │
│                                                      │
│     Current Balance: $2,450                         │
│     Monthly Payment: $350                           │
│     Strategy: Avalanche                             │
│                                                      │
│     ⚠️ Date may change if payments vary            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Calendar Event Types

| Event Type | Icon | Color | Source |
|------------|------|-------|--------|
| Bill Due | 📄 | Category color | billInstances |
| Credit Card Due | 💳 | Account color | billInstances (linkedAccountId) |
| Autopay Processing | 🔄 | Blue | bills.autopayDaysBefore |
| Projected Payoff | 🎉 | Green | Calculated from strategy |
| Payoff Milestone | 🏆 | Gold | billMilestones |

---

## Transfers & Edge Cases

### Balance Transfers

Moving debt from one credit card to another:

**Scenario:** Transfer $2,000 from Chase (19.99% APR) to Citi (0% APR promo)

```typescript
// This creates TWO transactions:

// 1. Balance transfer OUT (reduces Chase balance)
{
  type: 'balance_transfer_out',
  accountId: 'chase-card',
  amount: 2000,
  description: 'Balance transfer to Citi',
  linkedTransferId: 'transfer-123',
}

// 2. Balance transfer IN (increases Citi balance)  
{
  type: 'balance_transfer_in',
  accountId: 'citi-card',
  amount: 2000,
  description: 'Balance transfer from Chase',
  linkedTransferId: 'transfer-123',
  // May include balance transfer fee
  balanceTransferFee: 60,  // 3% fee
}
```

**UI Flow:**
```
1. User selects "Balance Transfer" action
2. From Card: [Chase Sapphire ▼]
3. To Card: [Citi Double Cash ▼]
4. Amount: $2,000
5. Transfer Fee: $60 (3%)
6. Total added to Citi: $2,060

[Create Balance Transfer]
```

**Effects:**
- Chase balance: -$2,000
- Citi balance: +$2,060 (includes fee)
- Both tracked in payment history
- Strategy recalculates

### Refunds on Credit Cards

When a refund posts to a credit card:

```typescript
// Refund transaction
{
  type: 'expense',           // Negative expense
  amount: -45.99,            // Negative = refund
  accountId: 'chase-card',
  categoryId: 'shopping',    // Same category as original
  description: 'Amazon Refund',
}
```

**Effects:**
- Credit card balance decreases (less owed)
- Available credit increases
- Category spending decreases (for budget)
- Does NOT affect bill instance (payment bill unchanged)
- Does NOT count as a "payment" in payment history

**Display:**
```
Transaction List:
  Dec 15  Amazon Refund           +$45.99  💳 Chase
          Shopping • Refund

Credit Card Summary:
  Previous Balance:    $847.52
  Refund:             -$45.99
  Current Balance:     $801.53
```

### Overpayment (Credit Balance)

When user pays more than owed:

**Scenario:** Balance is $200, user pays $250

```
Before Payment:
  Balance Owed:      $200
  Available Credit:  $4,800
  Credit Limit:      $5,000

After $250 Payment:
  Balance Owed:      $0
  Credit Balance:    $50 (overpaid)
  Available Credit:  $5,050 (limit + credit)
```

**Storage:**
```typescript
// currentBalance can be negative (credit balance)
account.currentBalance = -50;  // Negative = credit in your favor

// Display logic:
if (currentBalance < 0) {
  display = `Credit: $${Math.abs(currentBalance)}`;
  availableCredit = creditLimit + Math.abs(currentBalance);
} else {
  display = `Owed: $${currentBalance}`;
  availableCredit = creditLimit - currentBalance;
}
```

**UI Display:**
```
┌─────────────────────────────────────┐
│ 💳 Chase Sapphire                   │
│                                     │
│     $5,050                          │
│     Available Credit                │
│                                     │
│     Credit Balance: $50             │
│     (You overpaid)                  │
│                                     │
└─────────────────────────────────────┘
```

### Partial Payments

When user pays less than minimum:

**Scenario:** Minimum is $49, user pays $25

```typescript
// Payment transaction
{
  type: 'transfer',
  amount: 25,
  fromAccountId: 'checking',
  toAccountId: 'chase-card',
}

// Bill instance update
billInstance.actualAmount = 25;
billInstance.status = 'partial';  // New status
billInstance.notes = 'Partial payment - $24 short of minimum';
```

**Bill Instance Statuses:**
```typescript
status: enum {
  'pending',      // Not yet due
  'paid',         // Paid in full (>= expected)
  'partial',      // Paid but less than expected
  'overdue',      // Past due, not paid
  'skipped',      // Manually skipped
}
```

**UI Display:**
```
┌─────────────────────────────────────┐
│ December Payment          PARTIAL   │
│                                     │
│ Due: $49.00                         │
│ Paid: $25.00                        │
│ Remaining: $24.00                   │
│                                     │
│ ⚠️ Below minimum payment           │
│ Interest and fees may apply         │
│                                     │
│ [Pay Remaining $24]                 │
└─────────────────────────────────────┘
```

---

## Tax Integration

### Tax-Deductible Interest

Some interest charges are tax-deductible. Track this on debt bills:

```typescript
bills {
  // For isDebt = true
  isInterestTaxDeductible: boolean,   // Can deduct interest on taxes
  taxDeductionType: enum,             // 'mortgage', 'student_loan', 'business', 'none'
  taxDeductionLimit: real,            // Annual limit (e.g., $2,500 for student loans)
}
```

### Deductible Interest Types

| Type | Deductible? | Limit | Tax Form |
|------|-------------|-------|----------|
| Mortgage Interest | Yes | Up to $750K loan | Schedule A |
| Student Loan Interest | Yes | $2,500/year | 1040 Line 21 |
| Business Credit Card | Yes | No limit | Schedule C |
| Personal Credit Card | No | - | - |
| HELOC (home improvement) | Yes | Combined with mortgage | Schedule A |
| HELOC (other use) | No | - | - |
| Auto Loan | No | - | - |

### Interest Tracking for Tax

When interest charges are recorded:

```typescript
// Transaction flagged as interest
{
  type: 'expense',
  amount: 125.47,
  accountId: 'mortgage-bill',  // or linkedAccountId
  categoryId: 'system-interest-charges',
  isInterestCharge: true,
  isTaxDeductible: true,       // Based on bill's taxDeductionType
  taxDeductionType: 'mortgage',
}
```

### Tax Report: Deductible Interest

```
┌─────────────────────────────────────────────────────┐
│  Tax-Deductible Interest - 2024                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  MORTGAGE INTEREST (Schedule A)      $8,423.12      │
│    Home Mortgage ················ $8,423.12         │
│                                                      │
│  STUDENT LOAN INTEREST (1040)        $1,847.00      │
│    Federal Student Loan ········· $1,247.00         │
│    Private Student Loan ········· $600.00           │
│    ⚠️ $653 over $2,500 limit - not deductible      │
│                                                      │
│  BUSINESS INTEREST (Schedule C)      $342.18        │
│    Business Credit Card ········· $342.18           │
│                                                      │
├─────────────────────────────────────────────────────┤
│  TOTAL DEDUCTIBLE                    $10,612.30     │
│  (Mortgage + $2,500 student + business)             │
└─────────────────────────────────────────────────────┘
```

### Bill Form: Tax Settings

```
┌─────────────────────────────────────────────────────┐
│  Tax Settings (for debt bills)                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [✓] Interest is tax-deductible                     │
│                                                      │
│  Deduction Type: [Mortgage Interest ▼]              │
│                                                      │
│  Options:                                           │
│    • Mortgage Interest (Schedule A)                 │
│    • Student Loan Interest ($2,500 limit)           │
│    • Business Interest (Schedule C)                 │
│    • HELOC - Home Improvement                       │
│    • None                                           │
│                                                      │
│  💡 Interest charges will be flagged for tax       │
│     reporting automatically                          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Notifications

### High Utilization Warning

Trigger notifications when credit utilization crosses thresholds:

```typescript
// Notification triggers
const UTILIZATION_THRESHOLDS = [
  { percent: 30, level: 'warning', message: 'Utilization above 30%' },
  { percent: 50, level: 'caution', message: 'Utilization above 50%' },
  { percent: 75, level: 'danger', message: 'Utilization above 75%' },
  { percent: 90, level: 'critical', message: 'Approaching credit limit' },
];
```

**Notification Example:**
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ High Credit Utilization                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Chase Sapphire utilization is now 52%               │
│                                                      │
│ Balance: $2,080 of $4,000 limit                     │
│                                                      │
│ 💡 Tip: Keeping utilization below 30% helps your   │
│    credit score.                                     │
│                                                      │
│ [View Account]  [Dismiss]                           │
└─────────────────────────────────────────────────────┘
```

### Credit Limit Change Tracking

When user updates credit limit, track for history:

```typescript
// Add to accountBalanceHistory or new table
creditLimitHistory {
  id: text,
  accountId: text,
  userId: text,
  householdId: text,
  
  previousLimit: real,
  newLimit: real,
  changeDate: text,
  changeReason: text,           // 'user_update', 'bank_increase', 'bank_decrease'
  
  createdAt: text,
}
```

**Notification for Limit Changes:**
```
┌─────────────────────────────────────────────────────┐
│ 💳 Credit Limit Updated                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Chase Sapphire limit changed:                       │
│                                                      │
│ Previous: $4,000                                    │
│ New: $6,000                                         │
│ Change: +$2,000                                     │
│                                                      │
│ Your utilization improved from 52% to 35%           │
│                                                      │
│ [View Account]                                      │
└─────────────────────────────────────────────────────┘
```

### Notification Types Summary

| Type | Trigger | Priority |
|------|---------|----------|
| Bill Due Reminder | X days before due | Normal |
| Autopay Processed | After autopay runs | Low |
| Autopay Failed | Insufficient funds | High |
| High Utilization | Crosses threshold | Normal |
| Credit Limit Change | Limit updated | Low |
| Payoff Milestone | 25/50/75/100% | Normal |
| Debt Paid Off | Balance reaches $0 | High (celebration) |
| Projected Payoff Date | Strategy calculated | Low |

---

## CSV Import Handling

### Credit Card Statement Import

When importing credit card CSV:

**Step 1: Detect Credit Card**
```
┌─────────────────────────────────────────────────────┐
│  Import to: [Chase Sapphire ▼]                      │
│                                                      │
│  ℹ️ This is a credit card account.                 │
│     Purchases will be expenses.                     │
│     Payments will be detected as transfers.         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Step 2: Transaction Type Detection**
```typescript
// Auto-detect transaction types from credit card CSV
function detectCreditCardTransactionType(row) {
  const amount = parseFloat(row.amount);
  const description = row.description.toLowerCase();
  
  // Payments (money going TO the card)
  if (amount < 0 || description.includes('payment') || description.includes('thank you')) {
    return 'payment';  // Will be matched to checking transfer
  }
  
  // Refunds
  if (amount < 0 || description.includes('refund') || description.includes('credit')) {
    return 'refund';
  }
  
  // Interest/Fees
  if (description.includes('interest') || description.includes('finance charge')) {
    return 'interest';
  }
  
  if (description.includes('fee') || description.includes('annual fee')) {
    return 'fee';
  }
  
  // Regular purchase
  return 'purchase';
}
```

**Step 3: Statement Info Capture**
```
┌─────────────────────────────────────────────────────┐
│  Statement Information (Optional)                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Statement Date:      [Dec 15, 2024    ]            │
│  Statement Balance:   [$847.52         ]            │
│  Minimum Payment:     [$25.00          ]            │
│  Payment Due Date:    [Jan 10, 2025    ]            │
│                                                      │
│  💡 This info helps with payment tracking           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Double-Entry Prevention

**The Problem:** Payment shows on BOTH accounts
```
Checking CSV:
  Dec 10  CHASE CARD PAYMENT  -$500

Credit Card CSV:
  Dec 10  PAYMENT THANK YOU   -$500
```

If both imported separately, the transfer is duplicated.

**Solution: Transfer Matching**

```typescript
// When importing, check for matching transfers
async function detectDuplicateTransfer(transaction, userId, householdId) {
  // Look for existing transfer within ±2 days, same amount
  const potentialMatches = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId),
        eq(transactions.amount, Math.abs(transaction.amount)),
        inArray(transactions.type, ['transfer_in', 'transfer_out']),
        between(
          transactions.date,
          addDays(transaction.date, -2),
          addDays(transaction.date, 2)
        )
      )
    );
  
  return potentialMatches;
}
```

**Import UI - Duplicate Detection:**
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Potential Duplicate Transfer Detected            │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Importing: PAYMENT THANK YOU - $500                 │
│ Date: Dec 10, 2024                                  │
│                                                      │
│ Matches existing transaction:                        │
│ CHASE CARD PAYMENT - $500 (Main Checking)           │
│ Date: Dec 10, 2024                                  │
│                                                      │
│ This appears to be the same transfer.               │
│                                                      │
│ ○ Skip this transaction (recommended)               │
│ ○ Import anyway (creates duplicate)                 │
│ ○ Link to existing transfer                         │
│                                                      │
│ [Apply to All Similar]  [Continue]                  │
└─────────────────────────────────────────────────────┘
```

### Import Settings for Credit Cards

```typescript
importTemplates {
  // ... existing fields ...
  
  // Credit card specific
  isCreditCardTemplate: boolean,
  paymentDetectionPatterns: text,     // JSON: ["PAYMENT", "THANK YOU", ...]
  interestDetectionPatterns: text,    // JSON: ["INTEREST", "FINANCE CHARGE", ...]
  skipPaymentTransactions: boolean,   // Auto-skip payments (handle via checking import)
}
```

---

## Dashboard Widgets

### Debt-Free Countdown Widget

Updated to work with new architecture:

```
┌─────────────────────────────────────────────────────┐
│  🎯 Debt-Free Countdown                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│           8 months, 12 days                         │
│           until debt-free!                          │
│                                                      │
│  ████████████████░░░░░░░░░░░░░  62%                │
│  $12,450 paid of $20,100 total                      │
│                                                      │
│  Strategy: Avalanche                                │
│  Focus Debt: Chase Sapphire ($2,450)               │
│  Monthly Payment: $1,250                            │
│                                                      │
│  [View Strategy →]                                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Data Source:**
```typescript
// Pull from accounts (credit) + bills (isDebt) where includeInPayoffStrategy = true
const strategyDebts = await getAllDebts(userId, householdId)
  .filter(d => d.includeInPayoffStrategy);
```

### Credit Utilization Widget

Quick view of all credit cards:

```
┌─────────────────────────────────────────────────────┐
│  💳 Credit Utilization                              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Overall: 24% ✓ Good                                │
│  ████████░░░░░░░░░░░░░░░░░░░░░░                    │
│  $3,650 used of $15,000 total                       │
│                                                      │
│  By Card:                                           │
│  Chase Sapphire     ████████░░░ 35%  $1,400/$4,000 │
│  Amex Gold          ██████░░░░░ 25%  $1,250/$5,000 │
│  Citi Double Cash   █████░░░░░░ 17%  $1,000/$6,000 │
│                                                      │
│  💡 Keep under 30% for best credit score           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Utilization Color Coding:**
```css
.utilization-excellent { color: var(--color-success); }  /* 0-10% */
.utilization-good { color: var(--color-primary); }       /* 10-30% */
.utilization-fair { color: var(--color-warning); }       /* 30-50% */
.utilization-poor { color: var(--color-error); }         /* 50%+ */
```

### Next Payment Due Widget

Upcoming payments across all bills:

```
┌─────────────────────────────────────────────────────┐
│  📅 Next Payments Due                               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  TODAY                                              │
│  ⚡ Electric Bill ················ $142.00          │
│     🔄 Autopay scheduled                            │
│                                                      │
│  TOMORROW                                           │
│  💳 Chase Sapphire ·············· $350.00          │
│     Statement balance                               │
│                                                      │
│  DEC 15                                             │
│  📺 Netflix ····················· $15.99           │
│     💳 Charges to Amex                              │
│                                                      │
│  DEC 20                                             │
│  🎓 Student Loan ················ $250.00          │
│                                                      │
│  [View All Bills →]                                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Indicators:**
| Icon | Meaning |
|------|---------|
| 🔄 | Autopay enabled |
| 💳 | Charges to credit card |
| ⚠️ | Overdue |
| ✓ | Paid |

### Dashboard Layout with New Widgets

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                                               │
├───────────────────────────────┬─────────────────────────────────────────┤
│                               │                                          │
│  💰 Your Money                │  📅 Next Payments Due                   │
│  ━━━━━━━━━━━━━━━━━━━          │  ─────────────────────                   │
│  Cash & Bank: $12,450         │  Today: Electric $142                   │
│  Credit Available: $11,350    │  Tomorrow: Chase $350                   │
│                               │  Dec 15: Netflix $15.99                 │
│                               │                                          │
├───────────────────────────────┼─────────────────────────────────────────┤
│                               │                                          │
│  🎯 Debt-Free Countdown       │  💳 Credit Utilization                  │
│  ─────────────────────        │  ──────────────────────                  │
│  8 months, 12 days            │  Overall: 24% ✓ Good                    │
│  ████████████░░░░░ 62%        │  $3,650 / $15,000                       │
│  Focus: Chase Sapphire        │                                          │
│                               │  Chase:  ████████░░░ 35%                │
│                               │  Amex:   ██████░░░░░ 25%                │
│                               │                                          │
└───────────────────────────────┴─────────────────────────────────────────┘
```

---

## Bill Classification & Subscription Management

### Bill Classification Field

Bills are classified by what TYPE of recurring expense they are:

```typescript
bills {
  // ... existing fields ...
  
  // NEW: Bill classification for filtering/views
  billClassification: enum {
    'subscription',    // Netflix, Spotify, gym membership, software
    'utility',         // Electric, gas, water, internet, phone
    'housing',         // Rent, mortgage, HOA fees
    'insurance',       // Health, auto, home, life, renters
    'loan_payment',    // Car loan, student loan, personal loan
    'membership',      // Costco, AAA, professional dues, clubs
    'service',         // Lawn care, cleaning, pest control
    'other',           // Everything else
  }
  
  // Optional: Sub-category for grouping within view
  classificationSubcategory: text,   // 'streaming', 'software', 'fitness', etc.
}
```

### Auto-Suggestion Logic

When creating a bill, suggest classification based on name and patterns:

```typescript
function suggestBillClassification(billName: string, amount: number, frequency: string) {
  const name = billName.toLowerCase();
  
  // Known subscription services
  const subscriptionKeywords = [
    'netflix', 'spotify', 'hulu', 'disney', 'hbo', 'apple tv', 'youtube',
    'amazon prime', 'paramount', 'peacock', 'crunchyroll',
    'gym', 'fitness', 'planet fitness', 'la fitness', 'anytime fitness',
    'adobe', 'microsoft 365', 'office 365', 'dropbox', 'icloud', 'google one',
    'canva', 'figma', 'notion', 'slack', 'zoom',
    'headspace', 'calm', 'peloton', 'strava',
    'patreon', 'substack', 'medium',
  ];
  
  // Known utilities
  const utilityKeywords = [
    'electric', 'gas', 'water', 'power', 'utility', 'energy',
    'internet', 'wifi', 'broadband', 'comcast', 'xfinity', 'spectrum', 'att',
    'phone', 'mobile', 'verizon', 't-mobile', 'cell',
    'trash', 'garbage', 'waste', 'sewer',
  ];
  
  // Known insurance
  const insuranceKeywords = [
    'insurance', 'geico', 'state farm', 'allstate', 'progressive',
    'liberty mutual', 'farmers', 'usaa', 'nationwide',
    'health', 'dental', 'vision', 'life insurance',
  ];
  
  // Known housing
  const housingKeywords = ['rent', 'mortgage', 'hoa', 'condo fee', 'lease'];
  
  // Known memberships
  const membershipKeywords = ['costco', 'sams club', 'aaa', 'amazon prime', 'bjs'];
  
  // Check keywords
  if (subscriptionKeywords.some(k => name.includes(k))) return 'subscription';
  if (utilityKeywords.some(k => name.includes(k))) return 'utility';
  if (insuranceKeywords.some(k => name.includes(k))) return 'insurance';
  if (housingKeywords.some(k => name.includes(k))) return 'housing';
  if (membershipKeywords.some(k => name.includes(k))) return 'membership';
  
  // Heuristic: small monthly charges likely subscriptions
  if (frequency === 'monthly' && amount < 50) return 'subscription';
  
  return 'other';
}
```

### Bill Form with Classification

```
┌─────────────────────────────────────────────────────┐
│  Add New Bill                                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Name: [Netflix                    ]                │
│  Amount: [$15.99                   ]                │
│  Frequency: [Monthly ▼]                             │
│                                                      │
│  Classification: [Subscription ▼]  ← Auto-suggested │
│                                                      │
│  Sub-category (optional): [Streaming       ]        │
│                                                      │
│  💡 Detected "Netflix" - classified as subscription │
│                                                      │
│  ... other bill fields ...                          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Subscription Management View

Filter bills by `billClassification = 'subscription'`:

```
┌─────────────────────────────────────────────────────┐
│  📱 Subscriptions                    $152.11/month  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  STREAMING                           $45.97         │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │
│    Netflix ··················· $15.99  💳 Chase    │
│    Disney+ ··················· $13.99  💳 Chase    │
│    Spotify ··················· $10.99  💳 Amex     │
│    YouTube Premium ··········· $4.99   💳 Chase    │
│                                                      │
│  SOFTWARE                            $32.99         │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │
│    Adobe Creative Cloud ······ $22.99  💳 Chase    │
│    iCloud Storage ············ $2.99   💳 Apple    │
│    Microsoft 365 ············· $6.99   💳 Amex     │
│                                                      │
│  FITNESS                             $49.99         │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │
│    Planet Fitness ············ $24.99  🏦 Checking │
│    Headspace ················· $12.99  💳 Chase    │
│    Strava ···················· $11.99  💳 Amex     │
│                                                      │
│  OTHER                               $23.16         │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │
│    Patreon ··················· $15.00  💳 Chase    │
│    Cloud Backup ·············· $8.16   💳 Amex     │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Monthly Total:  $152.11                            │
│  Annual Cost:    $1,825.32                          │
│                                                      │
│  💡 Tip: Review subscriptions you haven't used     │
│     recently to save money                          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Other Classification Views

The same field enables views for all bill types:

**Utilities View:**
```
┌─────────────────────────────────────────────────────┐
│  ⚡ Utilities                        $342.00/month  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Electric (City Power) ·········· $142.00          │
│  Gas (National Gas) ············· $65.00           │
│  Water & Sewer ·················· $45.00           │
│  Internet (Xfinity) ············· $90.00           │
│                                                      │
│  Last Month: $328.00 (+4.3%)                        │
│  Year Avg:   $315.00                                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Insurance View:**
```
┌─────────────────────────────────────────────────────┐
│  🛡️ Insurance                       $485.00/month   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Health Insurance ··············· $350.00          │
│  Auto Insurance (Geico) ········· $95.00           │
│  Renters Insurance ·············· $25.00           │
│  Life Insurance ················· $15.00           │
│                                                      │
│  Annual Total: $5,820.00                            │
│                                                      │
│  📅 Auto renews: March 15, 2025                    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Housing View:**
```
┌─────────────────────────────────────────────────────┐
│  🏠 Housing                        $1,650.00/month  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Rent ··························· $1,500.00        │
│  HOA Fee ························ $150.00          │
│                                                      │
│  Annual Total: $19,800.00                           │
│  % of Income:   33%                                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Bills by Classification Summary

Dashboard widget showing all classifications:

```
┌─────────────────────────────────────────────────────┐
│  📊 Monthly Bills by Type                           │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🏠 Housing ··················· $1,650  ███████████ │
│  🛡️ Insurance ················· $485   ████        │
│  ⚡ Utilities ················· $342   ███         │
│  🚗 Loan Payments ············· $750   █████       │
│  📱 Subscriptions ············· $152   █           │
│  🎫 Memberships ··············· $45    ░           │
│  🔧 Services ················· $120   █           │
│                                                      │
│  Total Fixed Expenses:        $3,544/month          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Navigation / Filtering

Add filters to Bills page:

```
┌─────────────────────────────────────────────────────┐
│  Bills                                               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Filter: [All ▼] [Subscriptions] [Utilities]        │
│          [Insurance] [Housing] [Loans]              │
│                                                      │
│  ... filtered bill list ...                         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Simplified Category System

### Category Types (Simplified)

The category system is simplified from 6 types to 3:

```typescript
type: enum {
  'income',   // Money coming in (salary, freelance, dividends)
  'expense',  // Money going out (all expenses, including debt payments)
  'savings',  // Money set aside (transfers to savings, goal contributions)
}
```

### Why Simplify?

| Old System | Problem |
|------------|---------|
| `monthly_bill` vs `non_monthly_bill` | Frequency is a bill property, not category |
| `debt` | Auto-created categories eliminated |
| `variable_expense` vs `monthly_bill` | Confusing distinction for budgeting |

### New System Benefits

1. **Clear purpose** - Categories organize WHAT, not HOW OFTEN
2. **Flexible** - User creates categories that make sense to them
3. **Budget-friendly** - Simple: Income - Expenses - Savings = Surplus
4. **No auto-creation** - User controls all categories

### Example Category Setup

```
INCOME
  Salary
  Freelance
  Dividends
  Gifts Received

EXPENSE
  Rent
  Utilities
  Groceries
  Dining Out
  Entertainment
  Transportation
  Insurance
  Subscriptions
  Interest Charges (system)
  
SAVINGS
  Emergency Fund
  Vacation Fund
  Retirement
```

---

## Recurring Income

### Overview

Just like bills track recurring expenses, we need to track recurring income (salary, rent income, dividends).

### Extended Bills Table for Income

Rather than creating a separate table, extend bills to handle both directions:

```typescript
bills {
  // ... existing fields ...
  
  // NEW: Bill direction
  billType: enum,                 // 'expense', 'income'
  
  // For income bills:
  // - expectedAmount = expected income
  // - Creates income transactions instead of expenses
  // - Autopay creates income transaction on date
}
```

### Income Bill Examples

**Salary:**
```
┌─────────────────────────────────────────────────────┐
│ 💰 Salary - Acme Corp                               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Type: Income                                        │
│  Amount: $5,000                                      │
│  Frequency: Bi-weekly                                │
│  Deposits to: Main Checking                          │
│  Category: Salary                                    │
│                                                      │
│  Next Expected: Dec 15, 2024                         │
│                                                      │
│  [✓] Create transaction automatically               │
│      (when income is received)                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Rental Income:**
```
┌─────────────────────────────────────────────────────┐
│ 🏠 Rental Income - 123 Main St                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Type: Income                                        │
│  Amount: $1,800                                      │
│  Frequency: Monthly                                  │
│  Due Day: 1st                                        │
│  Deposits to: Main Checking                          │
│  Category: Rental Income                             │
│                                                      │
│  [✓] Track as expected (alert if not received)      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Income Bill Behavior

| Feature | Expense Bill | Income Bill |
|---------|--------------|-------------|
| Creates | Expense transactions | Income transactions |
| Direction | Money out | Money in |
| Autopay | Pulls from account | N/A (just tracks) |
| Alert | "Payment due" | "Income expected" |
| Miss | "Overdue" | "Not received" |

### Income in Budget

```
┌─────────────────────────────────────────────────────┐
│  Monthly Budget - December 2024                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  EXPECTED INCOME                     $6,800         │
│    Salary (bi-weekly x2) ········ $5,000           │
│    Rental Income ················ $1,800           │
│                                                      │
│  ACTUAL INCOME                       $5,000         │
│    ✓ Salary (Dec 1) ············· $2,500           │
│    ✓ Salary (Dec 15) ············ $2,500           │
│    ⏳ Rental (expected Dec 1) ···· $0    LATE      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Income Notifications

- "Salary expected tomorrow"
- "Rental income not received (3 days late)"
- "Income received: $2,500 from Acme Corp"

---

## Budget Rollover

### Overview

Unused budget from one month can roll over to the next, allowing users to "save up" in specific categories.

### How It Works

```
November Budget - Dining Out:
  Budget: $300
  Spent: $250
  Unused: $50
  
  [✓] Rollover enabled
  
December Budget - Dining Out:
  Base Budget: $300
  + Rollover: $50
  = Available: $350
```

### Rollover Settings Per Category

```typescript
budgetCategories {
  rolloverEnabled: boolean,       // Enable/disable rollover
  rolloverBalance: real,          // Current accumulated rollover
  rolloverLimit: real,            // Cap on rollover (null = unlimited)
}
```

### Rollover Calculation (Monthly Cron)

```typescript
async function processMonthlyRollover(userId, householdId) {
  const categories = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId),
        eq(budgetCategories.rolloverEnabled, true)
      )
    );
  
  for (const category of categories) {
    const spent = await getSpentThisMonth(category.id);
    const unused = Math.max(0, category.monthlyBudget - spent);
    
    // Add unused to rollover balance
    let newRollover = (category.rolloverBalance || 0) + unused;
    
    // Apply limit if set
    if (category.rolloverLimit !== null) {
      newRollover = Math.min(newRollover, category.rolloverLimit);
    }
    
    await db.update(budgetCategories)
      .set({ rolloverBalance: newRollover })
      .where(eq(budgetCategories.id, category.id));
  }
}
```

### Negative Rollover (Overspending)

Option to allow negative rollover (debt to yourself):

```
November Budget - Dining Out:
  Budget: $300
  Spent: $400
  Overspent: -$100
  
December Budget - Dining Out:
  Base Budget: $300
  - Overspend: $100
  = Available: $200
```

```typescript
budgetCategories {
  // ... existing fields ...
  allowNegativeRollover: boolean,  // Overspending reduces next month
}
```

### Rollover UI

**Category Card with Rollover:**
```
┌─────────────────────────────────────────────────────┐
│ 🍽️ Dining Out                                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Base Budget:     $300                              │
│  + Rollover:      $75                               │
│  ─────────────────────                              │
│  Available:       $375                              │
│                                                      │
│  Spent:           $180                              │
│  Remaining:       $195                              │
│                                                      │
│  ████████████░░░░░░░░░░░░░░░░░░  48%               │
│                                                      │
│  Rollover Settings:                                  │
│  [✓] Enable rollover                                │
│  [ ] Allow negative rollover                        │
│  Limit: $500 (optional)                             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Rollover Report

```
┌─────────────────────────────────────────────────────┐
│  Budget Rollover Summary - 2024                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Category              Rollover Balance             │
│  ─────────────────────────────────────              │
│  Dining Out            $75                          │
│  Entertainment         $120                         │
│  Clothing              $200 (at limit)              │
│  Home Maintenance      $450                         │
│                                                      │
│  Total Rollover:       $845                         │
│                                                      │
│  💡 Rollover = flexibility for variable spending    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Savings: Categories vs Goals

### The Relationship

**Savings Category** = Budget allocation (how much to save)
**Savings Goal** = Target tracking (what you're saving for)
**Savings Account** = Where money lives

### How They Connect

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│  BUDGET                    GOAL                      │
│  ───────                   ────                      │
│  Savings Category          Emergency Fund Goal       │
│  Budget: $500/month        Target: $10,000           │
│                            Current: $6,500           │
│           │                        ▲                 │
│           │    contributes to      │                 │
│           └────────────────────────┘                 │
│                                                      │
│           │                                          │
│           │    transfer to                           │
│           ▼                                          │
│                                                      │
│  ACCOUNT                                             │
│  ───────                                             │
│  High-Yield Savings                                  │
│  Balance: $6,500                                     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Savings Transaction Flow

**Step 1: Budget allocates savings**
```
Budget:
  Income: $5,000
  Expenses: $3,500
  Savings: $500    ← Category budget
  Surplus: $1,000
```

**Step 2: User creates savings transfer**
```
Transaction:
  Type: Transfer
  From: Main Checking
  To: High-Yield Savings
  Amount: $500
  Category: Savings (auto-assigned for transfers to savings accounts)
  Linked Goal: Emergency Fund (optional)
```

**Step 3: Goal progress updates**
```
Emergency Fund:
  Previous: $6,000
  + Contribution: $500
  = Current: $6,500
  
  Progress: 65% of $10,000
```

### Linking Transactions to Goals

```typescript
transactions {
  // ... existing fields ...
  
  // NEW: Goal linking
  savingsGoalId: text,            // Optional link to specific goal
}
```

### Savings Category Behavior

When a category has type `savings`:
1. Transfers TO savings accounts auto-categorize here
2. Shows in budget as "Savings" section
3. Can link to one or more goals
4. Tracks "Savings Rate" (savings / income)

### Auto-Link Savings to Goals

```
┌─────────────────────────────────────────────────────┐
│  Transfer to Savings                                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  From: Main Checking                                │
│  To: High-Yield Savings                             │
│  Amount: $500                                       │
│                                                      │
│  Link to Goal (optional):                           │
│  ○ Emergency Fund ($6,500 / $10,000)               │
│  ○ Vacation Fund ($800 / $2,000)                   │
│  ○ New Car ($1,200 / $15,000)                      │
│  ● Split between goals                              │
│                                                      │
│  Split:                                             │
│    Emergency Fund: $300                             │
│    Vacation Fund: $200                              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Savings Dashboard Widget

```
┌─────────────────────────────────────────────────────┐
│  💰 Savings Overview                                │
├─────────────────────────────────────────────────────┤
│                                                      │
│  This Month:                                         │
│    Budgeted: $500                                   │
│    Saved: $500 ✓                                    │
│    Savings Rate: 10%                                │
│                                                      │
│  Goals Progress:                                     │
│    Emergency Fund    ████████████░░░░ 65%           │
│    Vacation          ██████░░░░░░░░░░ 40%           │
│    New Car           █░░░░░░░░░░░░░░░ 8%            │
│                                                      │
│  Total Saved (All Goals): $8,500                    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Savings Automation

**Auto-transfer to savings:**
```typescript
bills {
  // Can be used for recurring savings transfers
  billType: 'savings_transfer',
  
  fromAccountId: text,            // Checking
  toAccountId: text,              // Savings account
  savingsGoalId: text,            // Optional goal to credit
}
```

This allows:
- "Transfer $500 to savings on the 1st of each month"
- Auto-credit to specific goal
- Shows in budget as savings allocation

---

## Budget Integration

### The Credit Card Double-Counting Problem

When budgeting with credit cards, there's a risk of counting expenses twice:

```
Scenario: Buy coffee for $5 with credit card, then pay card

WRONG (double-counting):
  Dec 1: Coffee purchase on credit card    → -$5 expense
  Dec 15: Pay credit card from checking    → -$5 expense
  Result: Budget shows -$10, but you only bought $5 of coffee!

RIGHT (purchase is expense, payment is transfer):
  Dec 1: Coffee purchase on credit card    → -$5 expense (categorized: Dining)
  Dec 15: Pay credit card from checking    → TRANSFER (not expense)
  Result: Budget shows -$5 (correct!)
```

### Solution: Purchase is Expense, Payment is Transfer

**Key insight:** The PURCHASE is the expense, not the PAYMENT.

- Credit card purchases = Categorized expenses (hit budget immediately)
- Credit card payments = Transfers (not expenses, just moving money)

This is the standard approach used by YNAB, Mint, and most finance apps.

### Transaction Type Handling

| Transaction | Type | Budget Impact | Notes |
|-------------|------|---------------|-------|
| Buy coffee with credit card | Expense | Yes - categorized "Dining" | Hits budget when purchased |
| Pay credit card from checking | Transfer | No | Just moving money |
| Pay car loan from checking | Expense + Bill | Yes - "Car Loan" | Debt payment |
| Interest charge on credit card | Expense | Yes - "Interest Charges" | Category: Interest |
| Refund on credit card | Negative Expense | Yes - reduces category | Offsets original purchase |

---

## Debt Payoff Strategy Toggle

### Overview

Users can choose between:
1. **Strategy Mode** - Centralized debt management with snowball/avalanche
2. **Manual Mode** - Each debt as individual budget line item

### Mode 1: Debt Payoff Strategy ENABLED

- All debts (in strategy) managed centrally in Debt section
- Snowball/avalanche determines payment priorities
- Budget shows single "Debt Payments" line linking to strategy
- User focuses on total debt budget, strategy allocates it

**Budget Display:**
```
┌─────────────────────────────────────────────────────┐
│  Monthly Budget - December 2024                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  INCOME                              $5,000         │
│    Salary ······················· $5,000           │
│                                                      │
│  BILLS & RECURRING                   $1,665         │
│    Rent ························· $1,500           │
│    Electric ····················· $150             │
│    Netflix ····················· $15               │
│                                                      │
│  DEBT PAYMENTS                       $750           │
│    ┌─────────────────────────────────────────┐     │
│    │ Managed by Debt Strategy (Avalanche)    │     │
│    │ Chase Card: $250 | Car Loan: $350       │     │
│    │ Student Loan: $150                      │     │
│    │ [View Strategy →]                       │     │
│    └─────────────────────────────────────────┘     │
│                                                      │
│  VARIABLE EXPENSES                   $750           │
│    Groceries ···················· $400             │
│    Dining ······················ $200              │
│    Gas ························· $150              │
│                                                      │
│  SAVINGS                             $500           │
│    Emergency Fund ·············· $500              │
│                                                      │
├─────────────────────────────────────────────────────┤
│  SURPLUS                             $1,335         │
└─────────────────────────────────────────────────────┘
```

### Mode 2: Debt Payoff Strategy DISABLED

- Each debt/credit card payment is individual budget line
- User manually sets each payment amount
- No strategy recommendations
- Simple budgeting like any other bill

**Budget Display:**
```
┌─────────────────────────────────────────────────────┐
│  Monthly Budget - December 2024                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  INCOME                              $5,000         │
│    Salary ······················· $5,000           │
│                                                      │
│  BILLS & RECURRING                   $1,665         │
│    Rent ························· $1,500           │
│    Electric ····················· $150             │
│    Netflix ····················· $15               │
│                                                      │
│  DEBT PAYMENTS                       $750           │
│    Chase Card Payment ·········· $200   [Edit]     │
│    Car Loan Payment ············ $350   [Edit]     │
│    Student Loan Payment ········ $200   [Edit]     │
│                                                      │
│  VARIABLE EXPENSES                   $750           │
│    Groceries ···················· $400             │
│    Dining ······················ $200              │
│    Gas ························· $150              │
│                                                      │
│  SAVINGS                             $500           │
│    Emergency Fund ·············· $500              │
│                                                      │
├─────────────────────────────────────────────────────┤
│  SURPLUS                             $1,335         │
└─────────────────────────────────────────────────────┘
```

---

## Per-Debt Strategy Inclusion

### The Problem

Not all debts should be in the payoff strategy. Examples:
- Credit card used daily and paid in full monthly (not really "debt")
- 0% APR promotional balance (no rush to pay off)
- Mortgage (30-year term, user prefers minimum payments)

### Solution: Include in Strategy Toggle

Each debt (credit account or debt bill) has an `includeInPayoffStrategy` flag:

```typescript
accounts {
  // For credit/line_of_credit types
  includeInPayoffStrategy: boolean,   // Default: true
}

bills {
  // For isDebt = true
  includeInPayoffStrategy: boolean,   // Default: true
}
```

### Behavior

**When `includeInPayoffStrategy = true`:**
- Debt appears in payoff strategy calculations
- Payment amount determined by snowball/avalanche
- Shows in "Managed by Strategy" section of budget
- Counts toward debt-free date calculation

**When `includeInPayoffStrategy = false`:**
- Debt excluded from payoff strategy
- Shows as individual budget line item (even if strategy enabled)
- User sets payment amount manually
- Does NOT count toward debt-free date

### UI: Debt Card with Toggle

```
┌─────────────────────────────────────────────────────┐
│ 💳 Chase Sapphire                           19.99%  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Balance: $2,450                                    │
│  Minimum: $49 • Available: $7,550                   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ Include in Debt Payoff Strategy    [✓ ON]   │   │
│  │                                              │   │
│  │ When ON: Payment managed by Avalanche       │   │
│  │ strategy. Currently allocated $350/month.   │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**When toggled OFF:**
```
┌─────────────────────────────────────────────────────┐
│ 💳 Amex Blue Cash                           0.00%   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Balance: $850                                      │
│  Minimum: $25 • Available: $4,150                   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ Include in Debt Payoff Strategy    [ OFF]   │   │
│  │                                              │   │
│  │ This card is excluded from the payoff       │   │
│  │ strategy. Set payment in Budget section.    │   │
│  │                                              │   │
│  │ 💡 0% APR until March 2025                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Budget Display with Mixed Strategy/Manual

When strategy is ENABLED but some debts are excluded:

```
┌─────────────────────────────────────────────────────┐
│  DEBT PAYMENTS                       $1,200         │
│                                                      │
│  In Payoff Strategy (Avalanche):     $950          │
│    ┌─────────────────────────────────────────┐     │
│    │ Chase Card: $350 | Car Loan: $350       │     │
│    │ Student Loan: $250                      │     │
│    │ [View Strategy →]                       │     │
│    └─────────────────────────────────────────┘     │
│                                                      │
│  Manual (Excluded from Strategy):    $250          │
│    Amex Blue Cash (0% APR) ······ $150   [Edit]    │
│    Store Card ·················· $100   [Edit]     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Use Cases for Excluding Debts

| Scenario | Why Exclude |
|----------|-------------|
| Daily-use card paid in full | Not really debt, just payment timing |
| 0% APR promotion | No interest, no urgency |
| Large mortgage | 30-year term, focus on other debts first |
| Business credit card | Separate from personal debt strategy |
| Shared household card | Partner manages this one |

### Settings Schema Update

```typescript
householdSettings {
  // Debt strategy settings
  debtStrategyEnabled: boolean,       // Master toggle for strategy mode
  debtPayoffMethod: enum,             // 'snowball', 'avalanche'
  extraMonthlyPayment: real,          // Extra toward strategy debts
}

accounts {
  // For credit/line_of_credit
  includeInPayoffStrategy: boolean,   // Default: true
}

bills {
  // For isDebt = true
  includeInPayoffStrategy: boolean,   // Default: true
}
```

### Edge Cases

**1. User disables strategy globally:**
- All debts become manual budget lines
- `includeInPayoffStrategy` settings preserved for when re-enabled

**2. All debts excluded from strategy:**
- Strategy section shows empty state
- Prompts user to include at least one debt or disable strategy

**3. Debt paid off while in strategy:**
- Removed from strategy automatically
- Freed-up payment rolls to next debt (snowball/avalanche)

**4. New debt created:**
- Default: `includeInPayoffStrategy = true`
- Prompt asks: "Add to payoff strategy?"

**5. Credit card with $0 balance:**
- Still shows toggle option
- If included, just not part of current calculations
- Automatically included if balance goes above $0

---

## Migration Notes

Since there are no production users yet, we can do a clean slate:

1. **Drop tables:** `debts`, `debtPayments`, `debtPayoffMilestones`, `debtSettings`
2. **Modify tables:** `accounts`, `bills`, `transactions`
3. **Remove columns:** `transactions.debtId`
4. **Add columns:** See schema changes above
5. **Clear test data:** Start fresh with new architecture

---

## Benefits Summary

### Core Simplifications
1. **Credit cards are naturally unified** - Account + auto-bill, no separate debt entity
2. **Two entities instead of four** - Account and Bill (no separate Debt, DebtPayment tables)
3. **Single "Add Bill" flow** - Toggle debt mode if needed
4. **Dormant debts supported** - `isActive=false` means no bill instances generated

### User Experience
5. **Category flexibility** - User picks category, no auto-created "Debt: X" categories
6. **Cleaner transactions** - Only `billId`, no `debtId` confusion
7. **Clear visual distinction** - Cash vs Available Credit always visually separated
8. **Intuitive credit card display** - Available in Accounts view, Owed in Debts view
9. **No double-counting** - Credit card purchases are expenses, payments are transfers

### Budget Integration
10. **Debt strategy toggle** - Choose between managed strategy or manual budget lines
11. **Per-debt inclusion** - Exclude daily-use cards, 0% APR, mortgages from strategy
12. **Mixed mode support** - Strategy debts + manual debts in same budget view
13. **Flexible workflow** - Power users get strategy, simple users get manual lines

### Automation
14. **Autopay for all bills** - Automatic transaction creation, not just credit cards
15. **Transfer → Payment detection** - Credit card payments auto-mark bill instances
16. **Annual fee auto-bills** - Created automatically when setting up credit card
17. **Subscription matching** - Bills that charge to cards matched to transactions

### Tracking & Reporting
18. **Payment history** - Complete audit trail of all bill payments
19. **Balance snapshots** - Daily tracking for utilization trends
20. **Interest tracking** - Dedicated category + reporting for interest paid
21. **Utilization trends** - Visual charts showing credit usage over time
22. **Credit limit history** - Track changes over time

### Financial Planning
23. **Unified debt payoff** - Credit accounts + debt bills in same strategy
24. **Per-debt strategy control** - Include/exclude individual debts from rolldown
25. **Line of credit support** - HELOCs and personal lines fully supported
26. **Net worth accuracy** - All liabilities properly calculated
27. **Milestone tracking** - Payoff milestones for both accounts and bills

### Calendar & Notifications
28. **Comprehensive calendar** - Bill due dates, autopay dates, projected payoffs
29. **Utilization alerts** - Warnings at 30%, 50%, 75%, 90% thresholds
30. **Milestone celebrations** - Notifications when payoff goals achieved

### Tax Integration
31. **Deductible interest tracking** - Flag mortgage, student loan, business interest
32. **Tax reports** - Deductible interest summary by type with limits
33. **Auto-classification** - Interest charges tagged for tax reporting

### Edge Case Handling
34. **Balance transfers** - Move debt between cards with fee tracking
35. **Refunds** - Properly handle returns on credit cards
36. **Overpayments** - Credit balance situations handled gracefully
37. **Partial payments** - Track shortfalls when paying less than minimum

### CSV Import
38. **Smart detection** - Auto-detect purchases, payments, refunds, interest, fees
39. **Duplicate prevention** - Detect transfers that appear in multiple accounts
40. **Statement capture** - Import statement info for better tracking

### Simplified Categories
41. **Three types only** - Income, Expense, Savings (no more confusing subtypes)
42. **User-controlled** - No auto-created categories
43. **Flexible organization** - User creates categories that make sense to them

### Recurring Income
44. **Income bills** - Track salary, rental income, dividends like bills
45. **Expected vs actual** - See if income arrived as expected
46. **Income alerts** - Notifications when expected income is late

### Budget Rollover
47. **Carry unused budget** - Didn't spend grocery budget? It rolls to next month
48. **Rollover limits** - Cap how much can accumulate
49. **Negative rollover** - Overspending reduces next month's budget (optional)

### Savings Integration
50. **Link to goals** - Connect savings transfers to specific goals
51. **Split contributions** - One transfer can fund multiple goals
52. **Savings rate tracking** - See what % of income you're saving
53. **Auto-categorize** - Transfers to savings accounts auto-tagged

### Bill Classification & Subscriptions
54. **Classify bills by type** - Subscription, utility, insurance, housing, loan, etc.
55. **Auto-suggest classification** - Smart detection based on bill name
56. **Subscription management view** - See all subscriptions grouped by sub-category
57. **Classification views** - Utilities view, insurance view, etc.
58. **Bills by type summary** - Dashboard widget showing spending by classification

---

## Implementation Phases

### Phase 1: Schema Changes
- Simplify category types to: income, expense, savings
- Add rollover fields to categories (rolloverEnabled, rolloverBalance, rolloverLimit)
- Add billType to bills (expense, income, savings_transfer)
- Add credit card fields to accounts table
- Add line of credit account type
- Add debt extension fields to bills table
- Add autopay fields to bills table
- Add linkedAccountId and chargedToAccountId to bills
- Add `includeInPayoffStrategy` to accounts and bills
- Add `debtStrategyEnabled` to household settings
- Add tax deduction fields to bills (isInterestTaxDeductible, taxDeductionType)
- Add partial payment status to bill instances
- Add savingsGoalId to transactions
- Create `billPayments` table for payment history
- Create `accountBalanceHistory` table for utilization trends
- Create `billMilestones` table
- Create `creditLimitHistory` table
- Add system category for interest charges
- Update import templates with credit card patterns
- Remove debtId from transactions
- Drop deprecated tables (debts, debtPayments, debtPayoffMilestones, debtSettings)

### Phase 2: Account Creation Flow
- Update account form with credit card fields
- Add line of credit account type option
- Add annual fee fields with auto-bill creation
- Add "Set up payment tracking" toggle
- Add "Include in payoff strategy" toggle (default: on)
- Auto-create linked bill on credit card account creation
- Auto-create annual fee bill if annual fee > 0
- Track credit limit changes in history

### Phase 3: Bill Form Updates
- Add "This is a debt" toggle
- Show/hide debt fields based on toggle
- Add linkedAccountId selector for credit card payment bills
- Add chargedToAccountId selector for bills that charge to a card
- Add autopay configuration section (all bills)
- Add "Include in payoff strategy" toggle for debt bills
- Add tax deduction settings for debt bills

### Phase 4: Display Updates [COMPLETED 2025-12-03]
- [x] Accounts page: Group by Cash vs Credit/Line of Credit
- [x] Show available credit for credit cards and lines of credit
- [x] Debts page: Show credit card balances + debt bills unified
- [x] Dashboard: Separate cash totals from credit availability
- [x] Add utilization trends chart
- [x] Add balance history chart
- [x] Show strategy inclusion status on debt cards
- [x] Handle overpayment/credit balance display

### Phase 5: Transaction Flow Updates [COMPLETED 2025-12-04]
- [x] Partial payment handling with shortfall tracking (bill-payment-utils.ts)
- [x] Payment history recording for all bill payments (bill_payments table, API endpoints)
- [x] Credit card payments via transfer with auto bill instance marking
- [x] Balance transfers between credit cards (isBalanceTransfer field, skips bill marking)
- [x] Refunds on credit cards (isRefund field for income on credit accounts)
- [x] Loan/debt bill payments via expense with bill selection (uses processBillPayment)
- [x] Auto-match transactions for bills with chargedToAccountId (Levenshtein + amount/date)
- [x] Credit card purchases as expenses (works correctly - no changes needed)
- [ ] Remove debt linking (use bill linking) - Deferred for gradual migration

### Phase 6: Autopay System [COMPLETED 2025-12-04]
- [x] Autopay amount calculator utility (lib/bills/autopay-calculator.ts)
- [x] Autopay transaction creator (lib/bills/autopay-transaction.ts)
- [x] Autopay batch processor (lib/bills/autopay-processor.ts)
- [x] Daily cron job endpoint (app/api/cron/autopay/route.ts)
- [x] Autopay notifications (lib/notifications/autopay-notifications.ts)
- [x] Suppress bill reminders for autopay-enabled bills

### Phase 7: Budget Integration [COMPLETED 2025-12-04]
- [x] Add debt strategy toggle to household settings
- [x] Strategy ENABLED: Single "Debt Payments" line in budget linking to strategy
- [x] Strategy DISABLED: Each debt as individual editable budget line
- [x] Mixed mode: Strategy debts grouped, excluded debts as manual lines
- [x] Ensure credit card purchases are expenses, payments are transfers
- [x] Created `/api/budgets/debts-unified` endpoint combining credit accounts and debt bills
- [x] Created `UnifiedDebtBudgetSection` component with strategy/manual modes
- [x] Updated budget manager modal with editable manual debt budgets
- [x] Added `budgetedMonthlyPayment` field to accounts and bills tables

### Phase 8: Payoff Strategy & Per-Debt Inclusion [COMPLETED 2025-12-04]
- [x] Update calculations to pull from accounts (credit) + bills (isDebt)
- [x] Filter by `includeInPayoffStrategy` flag
- [x] Unified debt list from both sources
- [x] Move payoff settings to household settings (with backward compatibility)
- [x] Milestones on bills and accounts (uses existing `billMilestones` table from Phase 1.3)
- [x] Handle debts excluded from strategy separately
- [x] Recalculate when debt paid off or toggled (strategy toggle API)

**Implementation Details:**
- Updated `/api/debts/payoff-strategy` to use unified debt sources (credit accounts + debt bills)
- Created `/api/debts/strategy-toggle` endpoint for per-debt inclusion/exclusion
- Updated `/api/debts/settings` to use `householdSettings` with `debtSettings` fallback
- Updated `/api/debts/stats` to support unified mode with `?unified=true` (default)
- Updated debts page UI with working strategy toggle buttons
- Response includes `excludedDebts` section for debts not in strategy

### Phase 9: Calendar Integration [COMPLETED 2025-12-04]
- [x] Bill due dates on calendar (including credit card payment bills)
- [x] Autopay processing dates on calendar
- [x] Projected payoff dates on calendar
- [x] Payoff milestone celebrations on calendar

**Implementation Details:**
- Updated `/api/calendar/month` to include autopayEvents, payoffDates, and billMilestones
- Updated `/api/calendar/day` to include detailed autopay, payoff, and milestone information
- Enhanced `calendar-day.tsx` with new visual elements for autopay (Clock icon), payoff dates (TrendingDown icon), and milestones (Trophy icon)
- Enhanced `calendar-day-modal.tsx` with new sections: Scheduled Autopay, Projected Payoff Dates, Payoff Milestones
- Bill objects now include isDebt, isAutopayEnabled, linkedAccountName for rich display
- Autopay dates calculated as dueDate - autopayDaysBefore days
- Projected payoff dates calculated as balance / monthlyPayment months from now
- Bill milestones from `billMilestones` table displayed with achievement dates and progress

### Phase 10: Notifications [COMPLETED 2025-12-04]
- ✅ High utilization warnings at configurable thresholds (30%, 50%, 75%, 90%)
- ✅ Credit limit change notifications with utilization impact
- ✅ Unified debt milestone notifications (credit accounts + debt bills)
- ✅ Autopay success/failure notifications (completed in Phase 6)
- ✅ Notification settings UI with threshold selector and channel configuration
- ✅ API endpoint for cron job integration (`/api/notifications/utilization-alerts`)
- ✅ State tracking to prevent duplicate notifications (`utilizationAlertState` table)

### Phase 11: Tax Integration [COMPLETED 2025-12-04]
- ✅ Tax deduction settings on debt bills (already in place from Phase 3)
- ✅ Auto-classify interest payments from tax-deductible debt bills via `classifyInterestPayment()`
- ✅ Interest deduction summary in tax dashboard with progress bars for limits
- ✅ Annual limit tracking ($2,500 for student loan interest)
- ✅ Bill-level custom limits supported via `taxDeductionLimit` field
- ✅ New tax categories added: "HELOC/Home Equity Interest" and "Business Interest Expense"
- ✅ `interest_deductions` table for tracking interest deduction records
- ✅ API endpoint `/api/tax/interest-deductions` for fetching interest summary
- ✅ Limit warning notifications at 80% (approaching) and 100% (reached)
- ✅ Integration with bill payment flow in `processBillPayment()`

### Phase 12: CSV Import Enhancements [COMPLETED 2025-12-04]
- Credit card statement auto-detection from headers and transaction patterns
- Transaction type auto-detection (purchase, payment, refund, interest, fee, cash advance, balance transfer, reward)
- Statement info extraction from header rows (balance, due date, minimum payment, credit limit)
- Transfer duplicate prevention - detects when importing the other side of an existing transfer
- Pre-built templates for 7 major card issuers (Chase, Amex, Capital One, Discover, Citi, Bank of America, Wells Fargo)
- Database schema updates: sourceType, issuer, amountSignConvention on import_templates; ccTransactionType, potentialTransferId on import_staging
- New files: `lib/csv-import/credit-card-detection.ts`, `lib/csv-import/cc-templates.ts`

### Phase 13: Dashboard Widgets [COMPLETED 2025-12-04]
- ✅ Updated debt-free countdown widget to use unified debt sources (credit accounts + debt bills)
- ✅ Updated credit utilization widget to use accounts table instead of debts table
- ✅ Created Next Payment Due widget with overdue highlighting, autopay indicators, and credit card linking
- New files: `app/api/bills/next-due/route.ts`, `components/dashboard/next-payment-due-widget.tsx`
- Modified: `app/api/debts/countdown/route.ts`, `app/api/debts/credit-utilization/route.ts`

### Phase 14: Balance History & Trends [COMPLETED 2025-12-04]
- ✅ Daily cron job to capture balance snapshots (`app/api/cron/balance-snapshots/route.ts`)
- ✅ Utilization trend chart on Accounts page (toggle button to show/hide)
- ✅ Balance over time chart on Accounts page (stacked area chart with per-account breakdown)
- ✅ Credit limit history tracking (already implemented in Phase 1.1)
- ✅ "Interest Paid" report with monthly breakdown and per-account analysis
- New files: `app/api/cron/balance-snapshots/route.ts`, `app/api/accounts/interest-paid/route.ts`, `components/charts/interest-paid-chart.tsx`
- Modified: `app/dashboard/accounts/page.tsx`, `app/dashboard/debts/page.tsx`, `components/charts/index.ts`

### Phase 15: Category Simplification
- Migrate existing categories to new 3-type system
- Update category forms to use simplified types
- Update budget displays for new type groupings
- Remove debt/monthly_bill/non_monthly_bill type handling

### Phase 16: Recurring Income [COMPLETED 2025-12-04]
- ✅ Add billType='income' support to bills
- ✅ Income bill creation form with income classification (salary, rental, investment, freelance, benefits, refund)
- ✅ Expected vs actual income tracking in budget overview API
- ✅ "Income not received" late alerts with cron job `/api/cron/income-alerts`
- ✅ Income schedule on calendar with distinct styling
- ✅ Bills page filter tabs (All/Expenses/Income) with income-specific statistics
- ✅ Notification preferences for income late alerts

### Phase 17: Budget Rollover [COMPLETED 2025-12-04]
- ✅ Add rollover fields to categories (done in Phase 1.4)
- ✅ Monthly cron job to calculate rollovers (`/api/cron/budget-rollover`)
- ✅ Rollover display in budget UI (CategoryBudgetProgress with rollover badge)
- ✅ Negative rollover (overspending) option (`allowNegativeRollover` in household settings)
- ✅ Rollover limit settings per category
- ✅ Rollover summary report component (RolloverSummary)
- ✅ Budget rollover history table for audit trail
- ✅ API endpoints for rollover management (`/api/budgets/rollover`, `/api/categories/[id]/rollover`)
- ✅ Effective budget calculation (base + rollover) in budget overview API

### Phase 18: Savings-Goals Integration
- Add savingsGoalId to transactions
- Link savings transfers to goals
- Split contributions across multiple goals
- Auto-categorize transfers to savings accounts
- Savings dashboard widget with goal progress
- Savings rate tracking

### Phase 19: Bill Classification & Subscription Management
- Add billClassification field to bills table
- Add classificationSubcategory field for grouping
- Implement auto-suggestion logic based on bill name
- Subscription management view (filtered by classification)
- Other classification views (utilities, insurance, housing)
- Bills by type summary widget
- Filter controls on bills page

