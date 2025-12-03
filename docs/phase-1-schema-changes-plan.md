# Phase 1: Schema Changes Implementation Plan

## Overview

Phase 1 implements the foundational database schema changes for the Unified Debt, Bill & Credit Card Architecture. This phase creates the schema foundation upon which all subsequent phases will build.

**Related Architecture Document:** `docs/unified-debt-bill-credit-card-architecture.md`

**Estimated Time:** 3-4 days  
**Priority:** High - Foundation for all subsequent phases  
**Last Updated:** 2025-12-03

---

## Phase 1 Breakdown

Given the complexity, Phase 1 is divided into 5 sub-phases that can be implemented incrementally:

| Sub-Phase | Description | Est. Time |
|-----------|-------------|-----------|
| 1.1 | Accounts Enhancement (Credit Cards & Lines of Credit) | 0.5 day |
| 1.2 | Bills Enhancement (Debt Extension & Autopay) | 0.5 day |
| 1.3 | Bill Instances & Payments | 0.5 day |
| 1.4 | Categories & Household Settings | 0.5 day |
| 1.5 | Transactions & Legacy Cleanup | 1-2 days |

---

## Sub-Phase 1.1: Accounts Enhancement

### Changes to `accounts` Table

Add the following fields to enable credit card and line of credit functionality:

```typescript
// Updated type enum
type: text('type', {
  enum: ['checking', 'savings', 'credit', 'line_of_credit', 'investment', 'cash'],
}).notNull(),

// Statement tracking (for credit accounts)
statementBalance: real('statement_balance'),
statementDate: text('statement_date'),
statementDueDate: text('statement_due_date'),
minimumPaymentAmount: real('minimum_payment_amount'),
lastStatementUpdated: text('last_statement_updated'),

// Interest & payments (for credit accounts)
interestRate: real('interest_rate'),
minimumPaymentPercent: real('minimum_payment_percent'),  // e.g., 2%
minimumPaymentFloor: real('minimum_payment_floor'),      // e.g., $25
additionalMonthlyPayment: real('additional_monthly_payment'),

// Line of credit specific
isSecured: integer('is_secured', { mode: 'boolean' }).default(false),
securedAsset: text('secured_asset'),
drawPeriodEndDate: text('draw_period_end_date'),
repaymentPeriodEndDate: text('repayment_period_end_date'),
interestType: text('interest_type', { enum: ['fixed', 'variable'] }).default('fixed'),
primeRateMargin: real('prime_rate_margin'),

// Annual fee (for credit cards)
annualFee: real('annual_fee'),
annualFeeMonth: integer('annual_fee_month'),  // 1-12
annualFeeBillId: text('annual_fee_bill_id'),

// Auto-bill creation
autoCreatePaymentBill: integer('auto_create_payment_bill', { mode: 'boolean' }).default(true),

// Payoff strategy inclusion
includeInPayoffStrategy: integer('include_in_payoff_strategy', { mode: 'boolean' }).default(true),
```

### New Table: `creditLimitHistory`

Track credit limit changes over time:

```typescript
export const creditLimitHistory = sqliteTable(
  'credit_limit_history',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    previousLimit: real('previous_limit'),
    newLimit: real('new_limit').notNull(),
    changeDate: text('change_date').notNull(),
    changeReason: text('change_reason', {
      enum: ['user_update', 'bank_increase', 'bank_decrease', 'initial'],
    }).default('user_update'),
    utilizationBefore: real('utilization_before'),
    utilizationAfter: real('utilization_after'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    accountIdIdx: index('idx_credit_limit_history_account').on(table.accountId),
    userIdIdx: index('idx_credit_limit_history_user').on(table.userId),
    householdIdIdx: index('idx_credit_limit_history_household').on(table.householdId),
  })
);
```

### New Table: `accountBalanceHistory`

Track balance history for utilization trends:

```typescript
export const accountBalanceHistory = sqliteTable(
  'account_balance_history',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    snapshotDate: text('snapshot_date').notNull(),
    balance: real('balance').notNull(),
    creditLimit: real('credit_limit'),
    availableCredit: real('available_credit'),
    utilizationPercent: real('utilization_percent'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    accountIdIdx: index('idx_account_balance_history_account').on(table.accountId),
    userIdIdx: index('idx_account_balance_history_user').on(table.userId),
    householdIdIdx: index('idx_account_balance_history_household').on(table.householdId),
    snapshotDateIdx: index('idx_account_balance_history_date').on(table.snapshotDate),
    accountDateIdx: index('idx_account_balance_history_account_date').on(
      table.accountId,
      table.snapshotDate
    ),
  })
);
```

### Migration File: `0057_add_credit_card_fields.sql`

```sql
-- Add new account type 'line_of_credit'
-- Note: SQLite doesn't support ALTER COLUMN for enum changes,
-- so we handle this via application code

-- Add credit card fields to accounts
ALTER TABLE accounts ADD COLUMN statement_balance REAL;
ALTER TABLE accounts ADD COLUMN statement_date TEXT;
ALTER TABLE accounts ADD COLUMN statement_due_date TEXT;
ALTER TABLE accounts ADD COLUMN minimum_payment_amount REAL;
ALTER TABLE accounts ADD COLUMN last_statement_updated TEXT;
ALTER TABLE accounts ADD COLUMN interest_rate REAL;
ALTER TABLE accounts ADD COLUMN minimum_payment_percent REAL;
ALTER TABLE accounts ADD COLUMN minimum_payment_floor REAL;
ALTER TABLE accounts ADD COLUMN additional_monthly_payment REAL;

-- Line of credit specific fields
ALTER TABLE accounts ADD COLUMN is_secured INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN secured_asset TEXT;
ALTER TABLE accounts ADD COLUMN draw_period_end_date TEXT;
ALTER TABLE accounts ADD COLUMN repayment_period_end_date TEXT;
ALTER TABLE accounts ADD COLUMN interest_type TEXT DEFAULT 'fixed';
ALTER TABLE accounts ADD COLUMN prime_rate_margin REAL;

-- Annual fee fields
ALTER TABLE accounts ADD COLUMN annual_fee REAL;
ALTER TABLE accounts ADD COLUMN annual_fee_month INTEGER;
ALTER TABLE accounts ADD COLUMN annual_fee_bill_id TEXT;

-- Automation and strategy fields
ALTER TABLE accounts ADD COLUMN auto_create_payment_bill INTEGER DEFAULT 1;
ALTER TABLE accounts ADD COLUMN include_in_payoff_strategy INTEGER DEFAULT 1;

-- Create credit_limit_history table
CREATE TABLE IF NOT EXISTS credit_limit_history (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  previous_limit REAL,
  new_limit REAL NOT NULL,
  change_date TEXT NOT NULL,
  change_reason TEXT DEFAULT 'user_update',
  utilization_before REAL,
  utilization_after REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_credit_limit_history_account ON credit_limit_history(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_limit_history_user ON credit_limit_history(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_limit_history_household ON credit_limit_history(household_id);

-- Create account_balance_history table
CREATE TABLE IF NOT EXISTS account_balance_history (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  balance REAL NOT NULL,
  credit_limit REAL,
  available_credit REAL,
  utilization_percent REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_account_balance_history_account ON account_balance_history(account_id);
CREATE INDEX IF NOT EXISTS idx_account_balance_history_user ON account_balance_history(user_id);
CREATE INDEX IF NOT EXISTS idx_account_balance_history_household ON account_balance_history(household_id);
CREATE INDEX IF NOT EXISTS idx_account_balance_history_date ON account_balance_history(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_account_balance_history_account_date ON account_balance_history(account_id, snapshot_date);
```

---

## Sub-Phase 1.2: Bills Enhancement

### Changes to `bills` Table

```typescript
// Bill direction/type
billType: text('bill_type', {
  enum: ['expense', 'income', 'savings_transfer'],
}).default('expense'),

// Bill classification for filtering/views
billClassification: text('bill_classification', {
  enum: ['subscription', 'utility', 'housing', 'insurance', 'loan_payment', 'membership', 'service', 'other'],
}),
classificationSubcategory: text('classification_subcategory'),

// Link to account (for credit card payments)
linkedAccountId: text('linked_account_id'),
amountSource: text('amount_source', {
  enum: ['fixed', 'minimum_payment', 'statement_balance', 'full_balance'],
}).default('fixed'),

// For bills that charge TO a card (subscriptions)
chargedToAccountId: text('charged_to_account_id'),

// Autopay settings
isAutopayEnabled: integer('is_autopay_enabled', { mode: 'boolean' }).default(false),
autopayAccountId: text('autopay_account_id'),
autopayAmountType: text('autopay_amount_type', {
  enum: ['fixed', 'minimum_payment', 'statement_balance', 'full_balance'],
}),
autopayFixedAmount: real('autopay_fixed_amount'),
autopayDaysBefore: integer('autopay_days_before').default(0),

// Debt extension fields (for non-account debts like loans)
isDebt: integer('is_debt', { mode: 'boolean' }).default(false),
originalBalance: real('original_balance'),
remainingBalance: real('remaining_balance'),
interestRate: real('interest_rate'),
interestType: text('interest_type', {
  enum: ['fixed', 'variable', 'none'],
}).default('none'),
minimumPayment: real('minimum_payment'),
additionalMonthlyPayment: real('additional_monthly_payment'),
debtType: text('debt_type', {
  enum: ['personal_loan', 'student_loan', 'mortgage', 'auto_loan', 'medical', 'other'],
}),
color: text('color'),

// Payoff strategy inclusion
includeInPayoffStrategy: integer('include_in_payoff_strategy', { mode: 'boolean' }).default(true),

// Tax deduction settings (for debt bills)
isInterestTaxDeductible: integer('is_interest_tax_deductible', { mode: 'boolean' }).default(false),
taxDeductionType: text('tax_deduction_type', {
  enum: ['mortgage', 'student_loan', 'business', 'heloc_home', 'none'],
}).default('none'),
taxDeductionLimit: real('tax_deduction_limit'),
```

### Migration File: `0058_add_bill_enhancements.sql`

```sql
-- Bill type and classification
ALTER TABLE bills ADD COLUMN bill_type TEXT DEFAULT 'expense';
ALTER TABLE bills ADD COLUMN bill_classification TEXT;
ALTER TABLE bills ADD COLUMN classification_subcategory TEXT;

-- Account linking
ALTER TABLE bills ADD COLUMN linked_account_id TEXT;
ALTER TABLE bills ADD COLUMN amount_source TEXT DEFAULT 'fixed';
ALTER TABLE bills ADD COLUMN charged_to_account_id TEXT;

-- Autopay settings
ALTER TABLE bills ADD COLUMN is_autopay_enabled INTEGER DEFAULT 0;
ALTER TABLE bills ADD COLUMN autopay_account_id TEXT;
ALTER TABLE bills ADD COLUMN autopay_amount_type TEXT;
ALTER TABLE bills ADD COLUMN autopay_fixed_amount REAL;
ALTER TABLE bills ADD COLUMN autopay_days_before INTEGER DEFAULT 0;

-- Debt extension fields
ALTER TABLE bills ADD COLUMN is_debt INTEGER DEFAULT 0;
ALTER TABLE bills ADD COLUMN original_balance REAL;
ALTER TABLE bills ADD COLUMN remaining_balance REAL;
ALTER TABLE bills ADD COLUMN interest_rate REAL;
ALTER TABLE bills ADD COLUMN interest_type TEXT DEFAULT 'none';
ALTER TABLE bills ADD COLUMN minimum_payment REAL;
ALTER TABLE bills ADD COLUMN additional_monthly_payment REAL;
ALTER TABLE bills ADD COLUMN debt_type TEXT;
ALTER TABLE bills ADD COLUMN color TEXT;

-- Payoff strategy
ALTER TABLE bills ADD COLUMN include_in_payoff_strategy INTEGER DEFAULT 1;

-- Tax deduction settings
ALTER TABLE bills ADD COLUMN is_interest_tax_deductible INTEGER DEFAULT 0;
ALTER TABLE bills ADD COLUMN tax_deduction_type TEXT DEFAULT 'none';
ALTER TABLE bills ADD COLUMN tax_deduction_limit REAL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_bills_bill_type ON bills(bill_type);
CREATE INDEX IF NOT EXISTS idx_bills_is_debt ON bills(is_debt);
CREATE INDEX IF NOT EXISTS idx_bills_linked_account ON bills(linked_account_id);
CREATE INDEX IF NOT EXISTS idx_bills_charged_to_account ON bills(charged_to_account_id);
CREATE INDEX IF NOT EXISTS idx_bills_classification ON bills(bill_classification);
```

---

## Sub-Phase 1.3: Bill Instances & Payments

### Changes to `billInstances` Table

```typescript
// Partial payment handling
paidAmount: real('paid_amount').default(0),
remainingAmount: real('remaining_amount'),
paymentStatus: text('payment_status', {
  enum: ['unpaid', 'partial', 'paid', 'overpaid'],
}).default('unpaid'),

// For debt bills - principal/interest breakdown
principalPaid: real('principal_paid').default(0),
interestPaid: real('interest_paid').default(0),
```

### New Table: `billPayments`

Track individual payments toward bill instances:

```typescript
export const billPayments = sqliteTable(
  'bill_payments',
  {
    id: text('id').primaryKey(),
    billId: text('bill_id').notNull(),
    billInstanceId: text('bill_instance_id'),
    transactionId: text('transaction_id'),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    amount: real('amount').notNull(),
    principalAmount: real('principal_amount'),
    interestAmount: real('interest_amount'),
    paymentDate: text('payment_date').notNull(),
    paymentMethod: text('payment_method', {
      enum: ['manual', 'transfer', 'autopay'],
    }).default('manual'),
    linkedAccountId: text('linked_account_id'),
    balanceBeforePayment: real('balance_before_payment'),
    balanceAfterPayment: real('balance_after_payment'),
    notes: text('notes'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    billIdIdx: index('idx_bill_payments_bill').on(table.billId),
    billInstanceIdIdx: index('idx_bill_payments_instance').on(table.billInstanceId),
    transactionIdIdx: index('idx_bill_payments_transaction').on(table.transactionId),
    userIdIdx: index('idx_bill_payments_user').on(table.userId),
    householdIdIdx: index('idx_bill_payments_household').on(table.householdId),
    paymentDateIdx: index('idx_bill_payments_date').on(table.paymentDate),
  })
);
```

### New Table: `billMilestones`

Track payoff milestones for debt bills and credit accounts:

```typescript
export const billMilestones = sqliteTable(
  'bill_milestones',
  {
    id: text('id').primaryKey(),
    billId: text('bill_id'),           // For debt bills
    accountId: text('account_id'),     // For credit accounts
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    percentage: integer('percentage').notNull(),  // 25, 50, 75, 100
    milestoneBalance: real('milestone_balance').notNull(),
    achievedAt: text('achieved_at'),
    notificationSentAt: text('notification_sent_at'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    billIdIdx: index('idx_bill_milestones_bill').on(table.billId),
    accountIdIdx: index('idx_bill_milestones_account').on(table.accountId),
    userIdIdx: index('idx_bill_milestones_user').on(table.userId),
    householdIdIdx: index('idx_bill_milestones_household').on(table.householdId),
    percentageIdx: index('idx_bill_milestones_percentage').on(table.percentage),
  })
);
```

### Migration File: `0059_add_bill_payments.sql`

```sql
-- Add partial payment fields to bill_instances
ALTER TABLE bill_instances ADD COLUMN paid_amount REAL DEFAULT 0;
ALTER TABLE bill_instances ADD COLUMN remaining_amount REAL;
ALTER TABLE bill_instances ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE bill_instances ADD COLUMN principal_paid REAL DEFAULT 0;
ALTER TABLE bill_instances ADD COLUMN interest_paid REAL DEFAULT 0;

-- Create bill_payments table
CREATE TABLE IF NOT EXISTS bill_payments (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  bill_instance_id TEXT,
  transaction_id TEXT,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  amount REAL NOT NULL,
  principal_amount REAL,
  interest_amount REAL,
  payment_date TEXT NOT NULL,
  payment_method TEXT DEFAULT 'manual',
  linked_account_id TEXT,
  balance_before_payment REAL,
  balance_after_payment REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_instance ON bill_payments(bill_instance_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_transaction ON bill_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_user ON bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_household ON bill_payments(household_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON bill_payments(payment_date);

-- Create bill_milestones table
CREATE TABLE IF NOT EXISTS bill_milestones (
  id TEXT PRIMARY KEY,
  bill_id TEXT,
  account_id TEXT,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  percentage INTEGER NOT NULL,
  milestone_balance REAL NOT NULL,
  achieved_at TEXT,
  notification_sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bill_milestones_bill ON bill_milestones(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_milestones_account ON bill_milestones(account_id);
CREATE INDEX IF NOT EXISTS idx_bill_milestones_user ON bill_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_milestones_household ON bill_milestones(household_id);
CREATE INDEX IF NOT EXISTS idx_bill_milestones_percentage ON bill_milestones(percentage);
```

---

## Sub-Phase 1.4: Categories & Household Settings

### Changes to `budgetCategories` Table

```typescript
// Simplified type (from 6 to 3)
type: text('type', {
  enum: ['income', 'expense', 'savings'],
}).notNull(),

// System category flags
isSystemCategory: integer('is_system_category', { mode: 'boolean' }).default(false),
isInterestCategory: integer('is_interest_category', { mode: 'boolean' }).default(false),

// Budget rollover
rolloverEnabled: integer('rollover_enabled', { mode: 'boolean' }).default(false),
rolloverBalance: real('rollover_balance').default(0),
rolloverLimit: real('rollover_limit'),  // null = unlimited
```

**Type Migration Mapping:**
| Old Type | New Type |
|----------|----------|
| `income` | `income` |
| `variable_expense` | `expense` |
| `monthly_bill` | `expense` |
| `non_monthly_bill` | `expense` |
| `debt` | `expense` |
| `savings` | `savings` |

### Changes to `householdSettings` Table

```typescript
// Debt payoff strategy settings
debtStrategyEnabled: integer('debt_strategy_enabled', { mode: 'boolean' }).default(false),
debtPayoffMethod: text('debt_payoff_method', {
  enum: ['snowball', 'avalanche'],
}).default('avalanche'),
extraMonthlyPayment: real('extra_monthly_payment').default(0),
paymentFrequency: text('payment_frequency', {
  enum: ['weekly', 'biweekly', 'monthly'],
}).default('monthly'),
```

### Migration File: `0060_add_category_rollover.sql`

```sql
-- Add system category flags
ALTER TABLE budget_categories ADD COLUMN is_system_category INTEGER DEFAULT 0;
ALTER TABLE budget_categories ADD COLUMN is_interest_category INTEGER DEFAULT 0;

-- Add rollover fields
ALTER TABLE budget_categories ADD COLUMN rollover_enabled INTEGER DEFAULT 0;
ALTER TABLE budget_categories ADD COLUMN rollover_balance REAL DEFAULT 0;
ALTER TABLE budget_categories ADD COLUMN rollover_limit REAL;

-- Add debt strategy settings to household_settings
ALTER TABLE household_settings ADD COLUMN debt_strategy_enabled INTEGER DEFAULT 0;
ALTER TABLE household_settings ADD COLUMN debt_payoff_method TEXT DEFAULT 'avalanche';
ALTER TABLE household_settings ADD COLUMN extra_monthly_payment REAL DEFAULT 0;
ALTER TABLE household_settings ADD COLUMN payment_frequency TEXT DEFAULT 'monthly';
```

### Category Type Migration Script

Create a Node.js script to migrate category types:

```javascript
// scripts/migrate-category-types.mjs
import { db } from '../lib/db/index.js';
import { budgetCategories } from '../lib/db/schema.js';
import { sql } from 'drizzle-orm';

const TYPE_MAPPING = {
  'income': 'income',
  'variable_expense': 'expense',
  'monthly_bill': 'expense',
  'non_monthly_bill': 'expense',
  'debt': 'expense',
  'savings': 'savings',
};

async function migrateCategories() {
  console.log('Starting category type migration...');
  
  for (const [oldType, newType] of Object.entries(TYPE_MAPPING)) {
    if (oldType === newType) continue;
    
    const result = await db.run(sql`
      UPDATE budget_categories 
      SET type = ${newType}
      WHERE type = ${oldType}
    `);
    
    console.log(`Migrated ${oldType} -> ${newType}: ${result.changes} rows`);
  }
  
  console.log('Category type migration complete!');
}

migrateCategories().catch(console.error);
```

---

## Sub-Phase 1.5: Transactions & Legacy Cleanup

### Changes to `transactions` Table

```typescript
// Link to savings goal
savingsGoalId: text('savings_goal_id'),

// Note: debtId will be REMOVED (not added)
```

### Migration File: `0061_add_savings_goal_link.sql`

```sql
-- Add savings goal link to transactions
ALTER TABLE transactions ADD COLUMN savings_goal_id TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_savings_goal ON transactions(savings_goal_id);
```

### Data Migration: Debts to Bills

Before dropping the legacy tables, migrate existing debt data:

```javascript
// scripts/migrate-debts-to-bills.mjs
import { db } from '../lib/db/index.js';
import { debts, debtPayments, debtPayoffMilestones, bills, billPayments, billMilestones } from '../lib/db/schema.js';
import { v4 as uuidv4 } from 'uuid';

async function migrateDebts() {
  console.log('Starting debt to bill migration...');
  
  // Get all existing debts
  const existingDebts = await db.select().from(debts);
  
  for (const debt of existingDebts) {
    // Create bill with debt extension
    const billId = uuidv4();
    await db.insert(bills).values({
      id: billId,
      userId: debt.userId,
      householdId: debt.householdId,
      name: debt.name,
      categoryId: debt.categoryId,
      expectedAmount: debt.minimumPayment || 0,
      dueDate: 15, // Default to 15th
      frequency: 'monthly',
      isActive: debt.status === 'active',
      // Debt extension fields
      isDebt: true,
      originalBalance: debt.originalAmount,
      remainingBalance: debt.remainingBalance,
      interestRate: debt.interestRate,
      interestType: debt.interestType,
      minimumPayment: debt.minimumPayment,
      additionalMonthlyPayment: debt.additionalMonthlyPayment,
      debtType: debt.type,
      color: debt.color,
      notes: debt.notes,
      createdAt: debt.createdAt,
    });
    
    console.log(`Migrated debt ${debt.name} to bill ${billId}`);
    
    // Migrate debt payments to bill payments
    const payments = await db.select()
      .from(debtPayments)
      .where(eq(debtPayments.debtId, debt.id));
    
    for (const payment of payments) {
      await db.insert(billPayments).values({
        id: uuidv4(),
        billId: billId,
        transactionId: payment.transactionId,
        userId: payment.userId,
        householdId: payment.householdId,
        amount: payment.amount,
        principalAmount: payment.principalAmount,
        interestAmount: payment.interestAmount,
        paymentDate: payment.paymentDate,
        paymentMethod: 'manual',
        notes: payment.notes,
        createdAt: payment.createdAt,
      });
    }
    
    // Migrate milestones
    const milestones = await db.select()
      .from(debtPayoffMilestones)
      .where(eq(debtPayoffMilestones.debtId, debt.id));
    
    for (const milestone of milestones) {
      await db.insert(billMilestones).values({
        id: uuidv4(),
        billId: billId,
        userId: milestone.userId,
        householdId: milestone.householdId,
        percentage: milestone.percentage,
        milestoneBalance: milestone.milestoneBalance,
        achievedAt: milestone.achievedAt,
        notificationSentAt: milestone.notificationSentAt,
        createdAt: milestone.createdAt,
      });
    }
  }
  
  console.log('Debt migration complete!');
}

migrateDebts().catch(console.error);
```

### Final Cleanup Migration: `0062_remove_legacy_debt_tables.sql`

**IMPORTANT:** Only run AFTER verifying data migration is successful!

```sql
-- Remove debtId from transactions
-- Note: SQLite doesn't support DROP COLUMN directly in older versions
-- We'll handle this by creating a new table and copying data

-- Update transaction references to use billId instead
UPDATE transactions 
SET bill_id = (
  SELECT b.id FROM bills b 
  INNER JOIN debts d ON d.id = transactions.debt_id 
  WHERE d.id = transactions.debt_id
)
WHERE debt_id IS NOT NULL;

-- Drop legacy tables (ONLY after verifying migration)
-- DROP TABLE IF EXISTS debt_payments;
-- DROP TABLE IF EXISTS debt_payoff_milestones;
-- DROP TABLE IF EXISTS debt_settings;
-- DROP TABLE IF EXISTS debts;

-- For safety, rename instead of drop initially
ALTER TABLE debts RENAME TO debts_deprecated;
ALTER TABLE debt_payments RENAME TO debt_payments_deprecated;
ALTER TABLE debt_payoff_milestones RENAME TO debt_payoff_milestones_deprecated;
ALTER TABLE debt_settings RENAME TO debt_settings_deprecated;
```

---

## Implementation Order

### Step 1: Create Migrations (Day 1)
1. Create `0057_add_credit_card_fields.sql`
2. Create `0058_add_bill_enhancements.sql`
3. Create `0059_add_bill_payments.sql`
4. Create `0060_add_category_rollover.sql`
5. Create `0061_add_savings_goal_link.sql`

### Step 2: Update Schema (Day 1)
1. Update `lib/db/schema.ts` with all new fields and tables
2. Add new relations
3. Run `pnpm drizzle-kit generate` to verify

### Step 3: Apply Migrations (Day 2)
1. Backup database: `cp sqlite.db sqlite.db.backup-$(date +%Y%m%d)`
2. Apply migrations: `pnpm drizzle-kit migrate`
3. Verify schema changes

### Step 4: Data Migration (Day 2-3)
1. Run category type migration script
2. Run debt to bill migration script
3. Verify all data migrated correctly
4. Test application functionality

### Step 5: Cleanup (Day 3-4)
1. Apply cleanup migration (rename legacy tables)
2. Update any remaining code references
3. Full application testing

---

## Testing Checklist

### Schema Tests
- [ ] All new columns added to accounts table
- [ ] All new columns added to bills table
- [ ] All new columns added to bill_instances table
- [ ] credit_limit_history table created
- [ ] account_balance_history table created
- [ ] bill_payments table created
- [ ] bill_milestones table created
- [ ] All indexes created

### Migration Tests
- [ ] Category types migrated correctly
- [ ] Debts migrated to bills with isDebt=true
- [ ] Debt payments migrated to bill_payments
- [ ] Milestones migrated to bill_milestones
- [ ] Transaction debtId references updated to billId

### Application Tests
- [ ] Account creation still works
- [ ] Bill creation still works
- [ ] Transaction creation still works
- [ ] Budget page loads correctly
- [ ] Debts page loads correctly (now showing debt bills)
- [ ] Reports generate correctly

---

## Rollback Plan

If issues occur during migration:

1. **Restore from backup:**
   ```bash
   cp sqlite.db.backup-YYYYMMDD sqlite.db
   ```

2. **Revert schema changes:**
   ```bash
   git checkout lib/db/schema.ts
   ```

3. **Delete migration files:**
   ```bash
   rm drizzle/0057_*.sql drizzle/0058_*.sql drizzle/0059_*.sql drizzle/0060_*.sql drizzle/0061_*.sql
   ```

---

## Notes

- All monetary calculations MUST use Decimal.js
- All new fields should use semantic color tokens in UI
- Legacy debt tables are RENAMED not dropped for safety
- Full backup required before any migrations

