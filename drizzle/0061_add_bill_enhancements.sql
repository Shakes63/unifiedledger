-- Migration: Phase 1.2 Bills Enhancement
-- Part of Unified Debt, Bill & Credit Card Architecture
-- 
-- This migration adds:
-- 1. Bill type and classification fields
-- 2. Account linking for credit card payments
-- 3. Autopay configuration
-- 4. Debt extension fields (for loans/mortgages)
-- 5. Payoff strategy and tax deduction settings

-- Bill type and classification
ALTER TABLE bills ADD COLUMN bill_type TEXT DEFAULT 'expense';
ALTER TABLE bills ADD COLUMN bill_classification TEXT;
ALTER TABLE bills ADD COLUMN classification_subcategory TEXT;

-- Account linking (for credit card payment bills)
ALTER TABLE bills ADD COLUMN linked_account_id TEXT;
ALTER TABLE bills ADD COLUMN amount_source TEXT DEFAULT 'fixed';
ALTER TABLE bills ADD COLUMN charged_to_account_id TEXT;

-- Autopay settings
ALTER TABLE bills ADD COLUMN is_autopay_enabled INTEGER DEFAULT 0;
ALTER TABLE bills ADD COLUMN autopay_account_id TEXT;
ALTER TABLE bills ADD COLUMN autopay_amount_type TEXT;
ALTER TABLE bills ADD COLUMN autopay_fixed_amount REAL;
ALTER TABLE bills ADD COLUMN autopay_days_before INTEGER DEFAULT 0;

-- Debt extension fields (for non-account debts like loans)
ALTER TABLE bills ADD COLUMN is_debt INTEGER DEFAULT 0;
ALTER TABLE bills ADD COLUMN original_balance REAL;
ALTER TABLE bills ADD COLUMN remaining_balance REAL;
ALTER TABLE bills ADD COLUMN bill_interest_rate REAL;
ALTER TABLE bills ADD COLUMN interest_type TEXT DEFAULT 'none';
ALTER TABLE bills ADD COLUMN minimum_payment REAL;
ALTER TABLE bills ADD COLUMN bill_additional_monthly_payment REAL;
ALTER TABLE bills ADD COLUMN debt_type TEXT;
ALTER TABLE bills ADD COLUMN bill_color TEXT;

-- Payoff strategy
ALTER TABLE bills ADD COLUMN include_in_payoff_strategy INTEGER DEFAULT 1;

-- Tax deduction settings
ALTER TABLE bills ADD COLUMN is_interest_tax_deductible INTEGER DEFAULT 0;
ALTER TABLE bills ADD COLUMN tax_deduction_type TEXT DEFAULT 'none';
ALTER TABLE bills ADD COLUMN tax_deduction_limit REAL;

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_bills_bill_type ON bills(bill_type);
CREATE INDEX IF NOT EXISTS idx_bills_is_debt ON bills(is_debt);
CREATE INDEX IF NOT EXISTS idx_bills_linked_account ON bills(linked_account_id);
CREATE INDEX IF NOT EXISTS idx_bills_charged_to_account ON bills(charged_to_account_id);
CREATE INDEX IF NOT EXISTS idx_bills_classification ON bills(bill_classification);
CREATE INDEX IF NOT EXISTS idx_bills_include_in_strategy ON bills(include_in_payoff_strategy);
CREATE INDEX IF NOT EXISTS idx_bills_debt_type ON bills(debt_type);

