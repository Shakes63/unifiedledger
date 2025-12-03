-- Migration: Add Credit Card and Line of Credit Fields
-- Phase 1.1 of Unified Debt, Bill & Credit Card Architecture
-- 
-- This migration adds:
-- 1. Credit card statement tracking fields to accounts
-- 2. Line of credit specific fields
-- 3. Annual fee tracking fields
-- 4. Payoff strategy inclusion flag
-- 5. credit_limit_history table for tracking limit changes
-- 6. account_balance_history table for utilization trends

-- Statement tracking (for credit accounts)
ALTER TABLE accounts ADD COLUMN statement_balance REAL;
ALTER TABLE accounts ADD COLUMN statement_date TEXT;
ALTER TABLE accounts ADD COLUMN statement_due_date TEXT;
ALTER TABLE accounts ADD COLUMN minimum_payment_amount REAL;
ALTER TABLE accounts ADD COLUMN last_statement_updated TEXT;

-- Interest & payments (for credit accounts)
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

-- Annual fee fields (for credit cards)
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
CREATE INDEX IF NOT EXISTS idx_credit_limit_history_change_date ON credit_limit_history(change_date);

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

-- Add indexes for new account fields
CREATE INDEX IF NOT EXISTS idx_accounts_interest_rate ON accounts(interest_rate);
CREATE INDEX IF NOT EXISTS idx_accounts_include_in_strategy ON accounts(include_in_payoff_strategy);

