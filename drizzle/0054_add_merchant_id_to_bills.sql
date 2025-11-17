-- ============================================================================
-- Add merchant_id to Bills Table
-- Date: 2025-01-15
-- Purpose: Enable bills to have an optional merchant for autofilling transaction merchant field
-- ============================================================================

-- Add merchant_id column to bills table (nullable, optional field)
ALTER TABLE bills ADD COLUMN merchant_id TEXT;

-- ============================================================================
-- Verification Queries (run these after migration to verify success)
-- ============================================================================
-- SELECT COUNT(*) FROM bills WHERE merchant_id IS NOT NULL; -- Should return 0 initially
-- SELECT COUNT(*) FROM bills; -- Total bills count

