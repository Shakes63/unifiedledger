-- Migration: Add user_household_preferences table for per-household user preferences
-- Part of Phase 0: Settings Three-Tier Architecture
-- Created: 2025-11-14

CREATE TABLE IF NOT EXISTS user_household_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,

  -- Preferences
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  number_format TEXT DEFAULT 'en-US',
  default_account_id TEXT,
  first_day_of_week TEXT DEFAULT 'sunday',

  -- Financial Display
  show_cents INTEGER DEFAULT 1,
  negative_number_format TEXT DEFAULT '-$100',
  default_transaction_type TEXT DEFAULT 'expense',

  -- Theme
  theme TEXT DEFAULT 'dark-mode',

  -- Notifications - Bill Reminders
  bill_reminders_enabled INTEGER DEFAULT 1,
  bill_reminders_channels TEXT DEFAULT '["push","email"]',

  -- Notifications - Budget Warnings
  budget_warnings_enabled INTEGER DEFAULT 1,
  budget_warnings_channels TEXT DEFAULT '["push","email"]',

  -- Notifications - Budget Exceeded
  budget_exceeded_enabled INTEGER DEFAULT 1,
  budget_exceeded_channels TEXT DEFAULT '["push","email"]',

  -- Notifications - Budget Reviews
  budget_review_enabled INTEGER DEFAULT 1,
  budget_review_channels TEXT DEFAULT '["push","email"]',

  -- Notifications - Low Balance
  low_balance_enabled INTEGER DEFAULT 1,
  low_balance_channels TEXT DEFAULT '["push","email"]',

  -- Notifications - Savings Milestones
  savings_milestones_enabled INTEGER DEFAULT 1,
  savings_milestones_channels TEXT DEFAULT '["push","email"]',

  -- Notifications - Debt Milestones
  debt_milestones_enabled INTEGER DEFAULT 1,
  debt_milestones_channels TEXT DEFAULT '["push","email"]',

  -- Notifications - Weekly Summaries
  weekly_summaries_enabled INTEGER DEFAULT 0,
  weekly_summaries_channels TEXT DEFAULT '["email"]',

  -- Notifications - Monthly Summaries
  monthly_summaries_enabled INTEGER DEFAULT 1,
  monthly_summaries_channels TEXT DEFAULT '["email"]',

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(user_id, household_id)
);

-- Indexes for performance
CREATE INDEX idx_user_household_prefs_user ON user_household_preferences(user_id);
CREATE INDEX idx_user_household_prefs_household ON user_household_preferences(household_id);
CREATE UNIQUE INDEX idx_user_household_prefs_unique ON user_household_preferences(user_id, household_id);
