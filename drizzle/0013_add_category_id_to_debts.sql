-- Migration: Add categoryId to debts table
-- This allows debts to be tracked via category matching (similar to bills)

ALTER TABLE debts ADD COLUMN category_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_debts_category ON debts(category_id);
