-- Calendar Sync Feature
-- Adds tables for external calendar integration (Google Calendar, TickTick)

-- Calendar connections (OAuth tokens)
CREATE TABLE IF NOT EXISTS calendar_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'ticktick')),
  calendar_id TEXT,
  calendar_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Sync settings per user per household
CREATE TABLE IF NOT EXISTS calendar_sync_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  sync_mode TEXT DEFAULT 'direct' CHECK (sync_mode IN ('direct', 'budget_period')),
  sync_bills INTEGER DEFAULT 1,
  sync_savings_milestones INTEGER DEFAULT 1,
  sync_debt_milestones INTEGER DEFAULT 1,
  sync_payoff_dates INTEGER DEFAULT 1,
  sync_goal_target_dates INTEGER DEFAULT 1,
  reminder_minutes INTEGER DEFAULT 1440,
  last_full_sync_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, household_id)
);

-- Track synced events for updates/deletes
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('bill_instance', 'savings_milestone', 'debt_milestone', 'goal_target', 'payoff_date', 'budget_period_bills')),
  source_id TEXT NOT NULL,
  event_date TEXT NOT NULL,
  sync_mode TEXT NOT NULL CHECK (sync_mode IN ('direct', 'budget_period')),
  event_title TEXT,
  last_synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (connection_id) REFERENCES calendar_connections(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_household ON calendar_connections(household_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_household ON calendar_connections(user_id, household_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_settings_user ON calendar_sync_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_settings_household ON calendar_sync_settings(household_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_settings_user_household ON calendar_sync_settings(user_id, household_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_household ON calendar_events(household_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_connection ON calendar_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_external ON calendar_events(external_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
