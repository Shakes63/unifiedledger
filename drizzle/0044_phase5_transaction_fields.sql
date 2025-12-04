-- Phase 5: Transaction Flow Updates
-- Add fields to support balance transfers and refunds

-- Add is_balance_transfer field to transactions table
ALTER TABLE transactions ADD COLUMN is_balance_transfer INTEGER DEFAULT 0;

-- Add is_refund field to transactions table  
ALTER TABLE transactions ADD COLUMN is_refund INTEGER DEFAULT 0;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_transactions_balance_transfer ON transactions(is_balance_transfer);
CREATE INDEX IF NOT EXISTS idx_transactions_refund ON transactions(is_refund);

