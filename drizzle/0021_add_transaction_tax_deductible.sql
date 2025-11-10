-- Add is_tax_deductible column to transactions table
ALTER TABLE transactions ADD COLUMN is_tax_deductible INTEGER DEFAULT 0;
