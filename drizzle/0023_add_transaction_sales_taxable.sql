-- Migration: Add isSalesTaxable field to transactions table
-- This simplifies sales tax tracking from rate-based to boolean flag system
-- Date: 2025-11-10

-- Add isSalesTaxable column to transactions table
ALTER TABLE transactions ADD COLUMN is_sales_taxable INTEGER DEFAULT 0;

-- Create index for efficient sales tax queries
CREATE INDEX IF NOT EXISTS idx_transactions_sales_taxable ON transactions(is_sales_taxable);
CREATE INDEX IF NOT EXISTS idx_transactions_user_sales_taxable ON transactions(user_id, is_sales_taxable);
