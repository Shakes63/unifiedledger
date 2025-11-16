-- Migration: Add household_id to categorization_rules and rule_execution_log
-- Created: 2025-01-27
-- Phase: 4 - Business Logic Household Isolation

-- Step 1: Add household_id column to categorization_rules (nullable first)
ALTER TABLE categorization_rules ADD COLUMN household_id TEXT;

-- Step 2: Add household_id column to rule_execution_log (nullable first)
ALTER TABLE rule_execution_log ADD COLUMN household_id TEXT;

-- Step 3: Backfill categorization_rules with user's first household
UPDATE categorization_rules
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = categorization_rules.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Step 4: Backfill rule_execution_log - inherit from parent rule (preferred) or transaction
UPDATE rule_execution_log
SET household_id = (
  SELECT COALESCE(
    (SELECT cr.household_id FROM categorization_rules cr WHERE cr.id = rule_execution_log.rule_id),
    (SELECT t.household_id FROM transactions t WHERE t.id = rule_execution_log.transaction_id)
  )
)
WHERE household_id IS NULL;

-- Step 5: Verify no NULLs remain (should return 0)
-- SELECT COUNT(*) FROM categorization_rules WHERE household_id IS NULL;
-- SELECT COUNT(*) FROM rule_execution_log WHERE household_id IS NULL;

-- Step 6: Create indexes for performance
CREATE INDEX idx_categorization_rules_household ON categorization_rules(household_id);
CREATE INDEX idx_categorization_rules_user_household ON categorization_rules(user_id, household_id);
CREATE INDEX idx_rule_execution_log_household ON rule_execution_log(household_id);
CREATE INDEX idx_rule_execution_log_user_household ON rule_execution_log(user_id, household_id);

-- Note: SQLite doesn't support ALTER COLUMN to add NOT NULL constraint,
-- so we rely on application-level validation. New inserts will use NOT NULL via Drizzle schema.

