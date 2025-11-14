-- ============================================================================
-- Phase 1: Add household_id to Core Financial Tables
-- Date: 2025-11-14
-- Purpose: Enable household data isolation for accounts, transactions, categories, merchants
-- ============================================================================

-- 1. ACCOUNTS TABLE
-- ============================================================================
ALTER TABLE accounts ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household (ordered by join date)
UPDATE accounts
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = accounts.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_accounts_household ON accounts(household_id);
CREATE INDEX idx_accounts_user_household ON accounts(user_id, household_id);

-- 2. TRANSACTIONS TABLE
-- ============================================================================
ALTER TABLE transactions ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household
UPDATE transactions
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = transactions.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes
CREATE INDEX idx_transactions_household ON transactions(household_id);
CREATE INDEX idx_transactions_user_household ON transactions(user_id, household_id);
CREATE INDEX idx_transactions_household_date ON transactions(household_id, date);

-- 3. BUDGET_CATEGORIES TABLE
-- ============================================================================
ALTER TABLE budget_categories ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household
UPDATE budget_categories
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = budget_categories.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes
CREATE INDEX idx_budget_categories_household ON budget_categories(household_id);
CREATE INDEX idx_budget_categories_user_household ON budget_categories(user_id, household_id);

-- 4. MERCHANTS TABLE
-- ============================================================================
ALTER TABLE merchants ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household
UPDATE merchants
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = merchants.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes
CREATE INDEX idx_merchants_household ON merchants(household_id);
CREATE INDEX idx_merchants_user_household ON merchants(user_id, household_id);

-- Update unique index to include household_id
-- Note: SQLite doesn't support DROP INDEX IF EXISTS in older versions
-- We need to drop the old unique index and create a new one
DROP INDEX IF EXISTS idx_merchants_user_normalized;
CREATE UNIQUE INDEX idx_merchants_user_household_normalized ON merchants(user_id, household_id, normalized_name);

-- 5. TRANSACTION_SPLITS TABLE
-- ============================================================================
ALTER TABLE transaction_splits ADD COLUMN household_id TEXT;

-- Backfill: Assign based on parent transaction's household
UPDATE transaction_splits
SET household_id = (
  SELECT t.household_id
  FROM transactions t
  WHERE t.id = transaction_splits.transaction_id
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes
CREATE INDEX idx_transaction_splits_household ON transaction_splits(household_id);
CREATE INDEX idx_transaction_splits_user_household ON transaction_splits(user_id, household_id);

-- 6. USAGE_ANALYTICS TABLE
-- ============================================================================
ALTER TABLE usage_analytics ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household
UPDATE usage_analytics
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = usage_analytics.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes
CREATE INDEX idx_usage_analytics_household ON usage_analytics(household_id);
CREATE INDEX idx_usage_analytics_user_household ON usage_analytics(user_id, household_id);

-- Update unique index to include household_id
DROP INDEX IF EXISTS idx_usage_analytics_unique;
CREATE UNIQUE INDEX idx_usage_analytics_unique ON usage_analytics(user_id, household_id, item_type, item_id, item_secondary_id);

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================
-- Run these manually after migration to verify success:
-- SELECT 'accounts' as table_name, COUNT(*) as null_count FROM accounts WHERE household_id IS NULL
-- UNION ALL
-- SELECT 'transactions', COUNT(*) FROM transactions WHERE household_id IS NULL
-- UNION ALL
-- SELECT 'budget_categories', COUNT(*) FROM budget_categories WHERE household_id IS NULL
-- UNION ALL
-- SELECT 'merchants', COUNT(*) FROM merchants WHERE household_id IS NULL
-- UNION ALL
-- SELECT 'transaction_splits', COUNT(*) FROM transaction_splits WHERE household_id IS NULL
-- UNION ALL
-- SELECT 'usage_analytics', COUNT(*) FROM usage_analytics WHERE household_id IS NULL;
--
-- All counts should be 0
-- ============================================================================
