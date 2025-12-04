-- Phase 10: Add utilization notification settings
-- Adds high utilization alerts and credit limit change notifications

-- Add high utilization alert settings to user_household_preferences
ALTER TABLE user_household_preferences ADD COLUMN high_utilization_enabled INTEGER DEFAULT 1;
ALTER TABLE user_household_preferences ADD COLUMN high_utilization_threshold INTEGER DEFAULT 75;
ALTER TABLE user_household_preferences ADD COLUMN high_utilization_channels TEXT DEFAULT '["push"]';

-- Add credit limit change notification settings
ALTER TABLE user_household_preferences ADD COLUMN credit_limit_change_enabled INTEGER DEFAULT 1;
ALTER TABLE user_household_preferences ADD COLUMN credit_limit_change_channels TEXT DEFAULT '["push"]';

-- Create utilization alert state table to track which thresholds have been notified
-- This prevents duplicate notifications for the same threshold crossing
CREATE TABLE IF NOT EXISTS utilization_alert_state (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  -- Track which thresholds have been notified (reset when utilization drops below)
  threshold_30_notified INTEGER DEFAULT 0,
  threshold_50_notified INTEGER DEFAULT 0,
  threshold_75_notified INTEGER DEFAULT 0,
  threshold_90_notified INTEGER DEFAULT 0,
  -- Last known utilization for comparison
  last_utilization REAL,
  last_checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_utilization_alert_account ON utilization_alert_state(account_id);
CREATE INDEX IF NOT EXISTS idx_utilization_alert_user ON utilization_alert_state(user_id);
CREATE INDEX IF NOT EXISTS idx_utilization_alert_household ON utilization_alert_state(household_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_utilization_alert_unique ON utilization_alert_state(account_id, user_id);

