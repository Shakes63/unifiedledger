-- Create debt settings table to store user preferences
CREATE TABLE IF NOT EXISTS debt_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  extra_monthly_payment REAL DEFAULT 0,
  preferred_method TEXT DEFAULT 'avalanche', -- 'snowball' or 'avalanche'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_debt_settings_user ON debt_settings(user_id);
