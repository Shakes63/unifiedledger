-- Migration: Add income frequency to budget categories
-- This enables frequency-based income tracking (weekly, biweekly, monthly, variable)
-- instead of inaccurate daily averages for regular income sources

-- Add income_frequency column to budget_categories
-- Valid values: 'weekly', 'biweekly', 'monthly', 'variable'
-- Default to 'variable' to maintain backward compatibility with existing categories
ALTER TABLE budget_categories ADD COLUMN income_frequency TEXT DEFAULT 'variable';
