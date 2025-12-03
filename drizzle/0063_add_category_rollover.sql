-- Migration: Phase 1.4 Categories & Household Settings
-- Part of Unified Debt, Bill & Credit Card Architecture
-- 
-- This migration adds:
-- 1. System category flags to budget_categories
-- 2. Budget rollover fields to budget_categories
-- 3. Debt payoff strategy settings to household_settings
--
-- Note: Category type simplification (6 types -> 3) is deferred
-- to avoid breaking existing code that depends on current type values

-- Add system category flags to budget_categories
ALTER TABLE budget_categories ADD COLUMN is_system_category INTEGER DEFAULT 0;
ALTER TABLE budget_categories ADD COLUMN is_interest_category INTEGER DEFAULT 0;

-- Add rollover fields to budget_categories
ALTER TABLE budget_categories ADD COLUMN rollover_enabled INTEGER DEFAULT 0;
ALTER TABLE budget_categories ADD COLUMN rollover_balance REAL DEFAULT 0;
ALTER TABLE budget_categories ADD COLUMN rollover_limit REAL;

-- Add debt payoff strategy settings to household_settings
ALTER TABLE household_settings ADD COLUMN debt_strategy_enabled INTEGER DEFAULT 0;
ALTER TABLE household_settings ADD COLUMN debt_payoff_method TEXT DEFAULT 'avalanche';
ALTER TABLE household_settings ADD COLUMN extra_monthly_payment REAL DEFAULT 0;
ALTER TABLE household_settings ADD COLUMN payment_frequency TEXT DEFAULT 'monthly';

-- Add indexes for new queryable fields
CREATE INDEX IF NOT EXISTS idx_budget_categories_system ON budget_categories(is_system_category);
CREATE INDEX IF NOT EXISTS idx_budget_categories_rollover ON budget_categories(rollover_enabled);

