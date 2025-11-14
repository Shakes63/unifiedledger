-- Migration: Add household_settings table for household-wide settings
-- Part of Phase 0: Settings Three-Tier Architecture
-- Created: 2025-11-14

CREATE TABLE IF NOT EXISTS household_settings (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL UNIQUE,

  -- Preferences
  currency TEXT DEFAULT 'USD',
  currency_symbol TEXT DEFAULT '$',
  time_format TEXT DEFAULT '12h',
  fiscal_year_start INTEGER DEFAULT 1,

  -- Financial
  default_budget_method TEXT DEFAULT 'monthly',
  budget_period TEXT DEFAULT 'monthly',
  auto_categorization INTEGER DEFAULT 1,

  -- Data Management
  data_retention_years INTEGER DEFAULT 7,
  auto_cleanup_enabled INTEGER DEFAULT 0,
  cache_strategy TEXT DEFAULT 'normal',

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for performance
CREATE INDEX idx_household_settings_household ON household_settings(household_id);
