# Phase 1.2: Bills Enhancement Implementation Plan

## Overview

Phase 1.2 extends the `bills` table to support debt tracking (for non-account debts like loans), autopay configuration, and bill classification. This enables bills to serve as the unified entity for both regular recurring payments and debt obligations.

**Parent Architecture Document:** `docs/unified-debt-bill-credit-card-architecture.md`  
**Parent Schema Plan:** `docs/phase-1-schema-changes-plan.md`  
**Estimated Time:** 0.5 day  
**Priority:** High - Foundation for subsequent phases  
**Last Updated:** 2025-12-03

---

## What This Phase Adds

### 1. Bill Type & Classification
- **billType**: Direction of money flow (expense, income, savings_transfer)
- **billClassification**: Category for filtering/views (subscription, utility, housing, etc.)
- **classificationSubcategory**: Additional detail (e.g., "Netflix" under "subscription")

### 2. Account Linking
- **linkedAccountId**: Links bill to a credit account (for credit card payment bills)
- **amountSource**: Where payment amount comes from (fixed, minimum_payment, statement_balance, full_balance)
- **chargedToAccountId**: Account this bill charges TO (for subscriptions paid via card)

### 3. Autopay Configuration
- **isAutopayEnabled**: Whether autopay is set up
- **autopayAccountId**: Account that autopay draws from
- **autopayAmountType**: What amount autopay pays
- **autopayFixedAmount**: Fixed amount if type is fixed
- **autopayDaysBefore**: Days before due date to pay

### 4. Debt Extension (for non-account debts)
- **isDebt**: Marks bill as a debt with balance tracking
- **originalBalance**: Starting debt amount
- **remainingBalance**: Current debt balance
- **interestRate**: APR for debt
- **interestType**: fixed, variable, or none
- **minimumPayment**: Required minimum payment
- **additionalMonthlyPayment**: Extra payment commitment
- **debtType**: Type of debt (personal_loan, student_loan, mortgage, auto_loan, medical, other)
- **color**: Color for UI display

### 5. Strategy & Tax Settings
- **includeInPayoffStrategy**: Include in debt payoff calculations
- **isInterestTaxDeductible**: Interest payments are tax deductible
- **taxDeductionType**: Type of deduction (mortgage, student_loan, business, heloc_home, none)
- **taxDeductionLimit**: Annual limit for deduction

---

## Implementation Steps

### Step 1: Create Migration File

Create `drizzle/0061_add_bill_enhancements.sql` with:
- All new columns for bills table
- Appropriate indexes for new fields
- Default values for existing bills

### Step 2: Update Schema

Update `lib/db/schema.ts`:
- Add all new fields to bills table definition
- Add appropriate TypeScript types
- Ensure proper enum constraints

### Step 3: Apply Migration

1. Backup database
2. Run migration
3. Verify all fields added

### Step 4: Verify

- Check that existing bills still work
- Verify new fields have correct defaults
- Test schema types match migration

---

## Migration SQL

```sql
-- Phase 1.2: Bills Enhancement
-- Adds debt extension, autopay, and classification fields to bills

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
CREATE INDEX IF NOT EXISTS idx_bills_include_in_strategy ON bills(include_in_payoff_strategy);
```

---

## Schema Changes

```typescript
// In lib/db/schema.ts - bills table additions

// Bill type and classification
billType: text('bill_type', {
  enum: ['expense', 'income', 'savings_transfer'],
}).default('expense'),
billClassification: text('bill_classification', {
  enum: ['subscription', 'utility', 'housing', 'insurance', 'loan_payment', 'membership', 'service', 'other'],
}),
classificationSubcategory: text('classification_subcategory'),

// Account linking
linkedAccountId: text('linked_account_id'),
amountSource: text('amount_source', {
  enum: ['fixed', 'minimum_payment', 'statement_balance', 'full_balance'],
}).default('fixed'),
chargedToAccountId: text('charged_to_account_id'),

// Autopay settings
isAutopayEnabled: integer('is_autopay_enabled', { mode: 'boolean' }).default(false),
autopayAccountId: text('autopay_account_id'),
autopayAmountType: text('autopay_amount_type', {
  enum: ['fixed', 'minimum_payment', 'statement_balance', 'full_balance'],
}),
autopayFixedAmount: real('autopay_fixed_amount'),
autopayDaysBefore: integer('autopay_days_before').default(0),

// Debt extension fields
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

// Payoff strategy
includeInPayoffStrategy: integer('include_in_payoff_strategy', { mode: 'boolean' }).default(true),

// Tax deduction settings
isInterestTaxDeductible: integer('is_interest_tax_deductible', { mode: 'boolean' }).default(false),
taxDeductionType: text('tax_deduction_type', {
  enum: ['mortgage', 'student_loan', 'business', 'heloc_home', 'none'],
}).default('none'),
taxDeductionLimit: real('tax_deduction_limit'),
```

---

## Testing Checklist

- [ ] Migration applies without errors
- [ ] All new columns exist in bills table
- [ ] Existing bills have correct default values
- [ ] Indexes created successfully
- [ ] Schema types match database structure
- [ ] Application starts without errors
- [ ] Bills page loads correctly
- [ ] Creating new bills still works

---

## What This Enables (Future Phases)

After Phase 1.2:
- **Phase 3 (Bill Form Updates)**: Can add debt fields to bill creation form
- **Phase 6 (Autopay System)**: Can implement autopay based on these settings
- **Phase 8 (Payoff Strategy)**: Can include debt bills in payoff calculations
- **Phase 11 (Tax Integration)**: Can calculate tax deductions from interest
- **Phase 19 (Bill Classification)**: Can filter/group bills by classification

---

## Notes

- All existing bills will default to `billType: 'expense'`, `isDebt: false`
- The `debtId` field on bills is NOT removed in this phase (cleanup is Phase 1.5)
- Debt extension fields are optional - regular bills don't use them
- Autopay configuration doesn't enable autopay processing (that's Phase 6)


