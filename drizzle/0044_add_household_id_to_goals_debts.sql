-- ============================================================================
-- Phase 3: Add household_id to Goals & Debts Tables
-- Date: 2025-01-27
-- Purpose: Enable household data isolation for savings goals and debts
-- ============================================================================

-- 1. SAVINGS_GOALS TABLE
-- ============================================================================
ALTER TABLE savings_goals ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household (ordered by join date)
UPDATE savings_goals
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = savings_goals.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_savings_goals_household ON savings_goals(household_id);
CREATE INDEX idx_savings_goals_user_household ON savings_goals(user_id, household_id);

-- 2. SAVINGS_MILESTONES TABLE
-- ============================================================================
ALTER TABLE savings_milestones ADD COLUMN household_id TEXT;

-- Backfill: Assign based on parent goal's household
UPDATE savings_milestones
SET household_id = (
  SELECT sg.household_id
  FROM savings_goals sg
  WHERE sg.id = savings_milestones.goal_id
)
WHERE household_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_savings_milestones_household ON savings_milestones(household_id);
CREATE INDEX idx_savings_milestones_user_household ON savings_milestones(user_id, household_id);

-- 3. DEBTS TABLE
-- ============================================================================
ALTER TABLE debts ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household (ordered by join date)
UPDATE debts
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = debts.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_debts_household ON debts(household_id);
CREATE INDEX idx_debts_user_household ON debts(user_id, household_id);

-- 4. DEBT_PAYMENTS TABLE
-- ============================================================================
ALTER TABLE debt_payments ADD COLUMN household_id TEXT;

-- Backfill: Assign based on parent debt's household
UPDATE debt_payments
SET household_id = (
  SELECT d.household_id
  FROM debts d
  WHERE d.id = debt_payments.debt_id
)
WHERE household_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_debt_payments_household ON debt_payments(household_id);
CREATE INDEX idx_debt_payments_user_household ON debt_payments(user_id, household_id);

-- 5. DEBT_PAYOFF_MILESTONES TABLE
-- ============================================================================
ALTER TABLE debt_payoff_milestones ADD COLUMN household_id TEXT;

-- Backfill: Assign based on parent debt's household
UPDATE debt_payoff_milestones
SET household_id = (
  SELECT d.household_id
  FROM debts d
  WHERE d.id = debt_payoff_milestones.debt_id
)
WHERE household_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_debt_payoff_milestones_household ON debt_payoff_milestones(household_id);
CREATE INDEX idx_debt_payoff_milestones_user_household ON debt_payoff_milestones(user_id, household_id);

-- 6. DEBT_SETTINGS TABLE
-- ============================================================================
ALTER TABLE debt_settings ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household (ordered by join date)
-- Note: Settings are per-household, so users with multiple households will need
-- separate settings records created when they access each household
UPDATE debt_settings
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = debt_settings.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_debt_settings_household ON debt_settings(household_id);
CREATE INDEX idx_debt_settings_user_household ON debt_settings(user_id, household_id);

-- ============================================================================
-- Verification Queries (run these after migration to verify success)
-- ============================================================================
-- SELECT COUNT(*) FROM savings_goals WHERE household_id IS NULL; -- Should return 0
-- SELECT COUNT(*) FROM savings_milestones WHERE household_id IS NULL; -- Should return 0
-- SELECT COUNT(*) FROM debts WHERE household_id IS NULL; -- Should return 0
-- SELECT COUNT(*) FROM debt_payments WHERE household_id IS NULL; -- Should return 0
-- SELECT COUNT(*) FROM debt_payoff_milestones WHERE household_id IS NULL; -- Should return 0
-- SELECT COUNT(*) FROM debt_settings WHERE household_id IS NULL; -- Should return 0

