-- Migration: Add transfer_suggestions table for intelligent transfer matching
-- Date: 2025-11-10
-- Feature: Enhanced Transfer Matching with confidence scoring

CREATE TABLE IF NOT EXISTS transfer_suggestions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_transaction_id TEXT NOT NULL,
  suggested_transaction_id TEXT NOT NULL,

  -- Scoring breakdown (multi-factor algorithm)
  amount_score REAL NOT NULL,
  date_score REAL NOT NULL,
  description_score REAL NOT NULL,
  account_score REAL NOT NULL,
  total_score REAL NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),

  -- User action tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  reviewed_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_transfer_suggestions_user ON transfer_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_suggestions_source ON transfer_suggestions(source_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transfer_suggestions_status ON transfer_suggestions(status);
