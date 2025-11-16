-- Add is_application_owner field to user table
-- This field marks the first user as the application owner
ALTER TABLE user ADD COLUMN is_application_owner INTEGER DEFAULT 0 NOT NULL;

-- Create index for quick owner lookup
CREATE INDEX IF NOT EXISTS idx_user_is_application_owner ON user(is_application_owner);

