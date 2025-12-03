-- Migration: Phase 1.5 Transactions Enhancement
-- Part of Unified Debt, Bill & Credit Card Architecture
-- 
-- This migration adds:
-- 1. Link to savings goals from transactions
--
-- Note: Debt-to-bill data migration and legacy table cleanup are deferred
-- to a separate migration after thorough testing to prevent data loss.

-- Add savings goal link to transactions
ALTER TABLE transactions ADD COLUMN savings_goal_id TEXT;

-- Add index for efficient savings goal queries
CREATE INDEX IF NOT EXISTS idx_transactions_savings_goal ON transactions(savings_goal_id);

