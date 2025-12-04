-- Migration: Add savings goal contributions table for tracking split contributions
-- Phase 18: Savings-Goals Integration

-- Create savings goal contributions table
CREATE TABLE IF NOT EXISTS savings_goal_contributions (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_goal_contributions_transaction ON savings_goal_contributions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON savings_goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_household ON savings_goal_contributions(user_id, household_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_created ON savings_goal_contributions(goal_id, created_at);

