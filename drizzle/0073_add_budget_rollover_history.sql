-- Migration: Phase 17 Budget Rollover
-- Part of Unified Debt, Bill & Credit Card Architecture
-- 
-- This migration adds:
-- 1. Budget rollover history table for audit trail
-- 2. Allow negative rollover setting to household_settings

-- Add negative rollover setting to household_settings
ALTER TABLE household_settings ADD COLUMN allow_negative_rollover INTEGER DEFAULT 0;

-- Create rollover history table for audit trail
CREATE TABLE IF NOT EXISTS budget_rollover_history (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM format
  previous_balance REAL NOT NULL DEFAULT 0,
  monthly_budget REAL NOT NULL DEFAULT 0,
  actual_spent REAL NOT NULL DEFAULT 0,
  rollover_amount REAL NOT NULL DEFAULT 0, -- amount added/subtracted this period
  new_balance REAL NOT NULL DEFAULT 0,
  rollover_limit REAL, -- NULL means unlimited
  was_capped INTEGER DEFAULT 0, -- 1 if limit was enforced
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rollover_history_category ON budget_rollover_history(category_id);
CREATE INDEX IF NOT EXISTS idx_rollover_history_household ON budget_rollover_history(household_id);
CREATE INDEX IF NOT EXISTS idx_rollover_history_month ON budget_rollover_history(month);
CREATE INDEX IF NOT EXISTS idx_rollover_history_category_month ON budget_rollover_history(category_id, month);

