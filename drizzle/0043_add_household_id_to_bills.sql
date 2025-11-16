-- ============================================================================
-- Phase 2: Add household_id to Bills Tables
-- Date: 2025-01-27
-- Purpose: Enable household data isolation for bills and bill instances
-- ============================================================================

-- 1. BILLS TABLE
-- ============================================================================
ALTER TABLE bills ADD COLUMN household_id TEXT;

-- Backfill: Assign to user's first household (ordered by join date)
UPDATE bills
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = bills.user_id
  AND hm.is_active = 1
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_bills_household ON bills(household_id);
CREATE INDEX idx_bills_user_household ON bills(user_id, household_id);

-- 2. BILL_INSTANCES TABLE
-- ============================================================================
ALTER TABLE bill_instances ADD COLUMN household_id TEXT;

-- Backfill: Assign based on parent bill's household
UPDATE bill_instances
SET household_id = (
  SELECT b.household_id
  FROM bills b
  WHERE b.id = bill_instances.bill_id
)
WHERE household_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_bill_instances_household ON bill_instances(household_id);
CREATE INDEX idx_bill_instances_user_household ON bill_instances(user_id, household_id);

-- ============================================================================
-- Verification Queries (run these after migration to verify success)
-- ============================================================================
-- SELECT COUNT(*) FROM bills WHERE household_id IS NULL; -- Should return 0
-- SELECT COUNT(*) FROM bill_instances WHERE household_id IS NULL; -- Should return 0
-- SELECT COUNT(*) FROM bills; -- Total bills count
-- SELECT COUNT(*) FROM bill_instances; -- Total bill instances count

