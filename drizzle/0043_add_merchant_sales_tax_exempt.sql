-- Add is_sales_tax_exempt column to merchants table
-- Allows marking merchants as tax exempt for sales tax calculations
-- Default: false (not exempt)
ALTER TABLE merchants ADD COLUMN is_sales_tax_exempt INTEGER DEFAULT 0;

