-- Add session activity tracking fields for inactivity-based session timeout
-- lastActivityAt: timestamp of last user activity (for timeout calculation)
-- rememberMe: flag to bypass inactivity timeout on trusted devices

-- Add lastActivityAt field (nullable first, then populate and make not null via constraint)
ALTER TABLE session ADD COLUMN last_activity_at INTEGER;

-- Add rememberMe field to bypass timeout for trusted devices
ALTER TABLE session ADD COLUMN remember_me INTEGER NOT NULL DEFAULT 0;

-- Set initial lastActivityAt to created_at for existing sessions
UPDATE session SET last_activity_at = created_at WHERE last_activity_at IS NULL;

-- Create index for efficient session timeout queries
CREATE INDEX IF NOT EXISTS idx_session_user_activity ON session(user_id, last_activity_at);

-- Create index for expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_session_expires_at ON session(expires_at);
