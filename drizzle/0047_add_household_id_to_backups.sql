-- Migration: Add household_id to backup tables
-- Created: 2025-11-16
-- Description: Adds household isolation to backup settings and backup history

-- Add household_id to backup_settings
ALTER TABLE backup_settings ADD COLUMN household_id TEXT;

-- Update unique constraint: remove old user-only unique, add user-household unique
-- Note: SQLite doesn't support DROP CONSTRAINT, so we'll create a new unique index
-- The old unique index on user_id will remain but won't enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_backup_settings_user_household_unique 
  ON backup_settings(user_id, household_id);

-- Add index for household queries
CREATE INDEX IF NOT EXISTS idx_backup_settings_household 
  ON backup_settings(user_id, household_id);

-- Add household_id to backup_history
ALTER TABLE backup_history ADD COLUMN household_id TEXT;

-- Add index for household queries on backup_history
CREATE INDEX IF NOT EXISTS idx_backup_history_household 
  ON backup_history(user_id, household_id);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_backup_history_user_household_created 
  ON backup_history(user_id, household_id, created_at);

-- Backfill existing data: assign to user's first household
-- For users with backup_settings but no household, set household_id to NULL
-- (These will need to be handled by application logic)
UPDATE backup_settings
SET household_id = (
  SELECT household_id 
  FROM household_members 
  WHERE household_members.user_id = backup_settings.user_id 
    AND household_members.is_active = 1
  ORDER BY household_members.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;

-- Backfill backup_history with household_id from backup_settings
UPDATE backup_history
SET household_id = (
  SELECT household_id 
  FROM backup_settings 
  WHERE backup_settings.id = backup_history.backup_settings_id
)
WHERE household_id IS NULL;

