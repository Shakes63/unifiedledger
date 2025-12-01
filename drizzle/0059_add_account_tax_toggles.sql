-- Migration: Add separate sales tax and tax deduction toggles to accounts
-- Replaces single isBusinessAccount toggle with two independent toggles
-- Date: 2025-12-01

-- Add enable_sales_tax column to accounts table
-- Controls whether sales tax tracking is enabled for this account
ALTER TABLE accounts ADD COLUMN enable_sales_tax INTEGER DEFAULT 0;

-- Add enable_tax_deductions column to accounts table
-- Controls whether business tax deduction tracking is enabled for this account
ALTER TABLE accounts ADD COLUMN enable_tax_deductions INTEGER DEFAULT 0;

-- Migrate existing data: if isBusinessAccount is true, enable both features
-- This preserves existing behavior for current business accounts
UPDATE accounts 
SET enable_sales_tax = is_business_account, 
    enable_tax_deductions = is_business_account 
WHERE is_business_account = 1;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_accounts_enable_sales_tax ON accounts(enable_sales_tax);
CREATE INDEX IF NOT EXISTS idx_accounts_enable_tax_deductions ON accounts(enable_tax_deductions);

-- Create composite index for household + feature queries (used in has-business API)
CREATE INDEX IF NOT EXISTS idx_accounts_household_sales_tax ON accounts(household_id, enable_sales_tax) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_accounts_household_tax_deductions ON accounts(household_id, enable_tax_deductions) WHERE is_active = 1;

