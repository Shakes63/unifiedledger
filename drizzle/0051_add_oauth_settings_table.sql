-- Create oauth_settings table for storing OAuth provider configurations
-- Client secrets are stored encrypted
CREATE TABLE IF NOT EXISTS oauth_settings (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create index for provider lookup
CREATE INDEX IF NOT EXISTS idx_oauth_settings_provider ON oauth_settings(provider_id);

