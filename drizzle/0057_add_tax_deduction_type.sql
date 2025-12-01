-- Add tax_deduction_type field to transactions table
-- This allows separating business tax deductions from personal tax deductions

ALTER TABLE transactions ADD COLUMN tax_deduction_type TEXT DEFAULT 'none';

-- Create index for efficient filtering by tax deduction type
CREATE INDEX idx_transactions_tax_deduction_type ON transactions(tax_deduction_type);

-- Backfill existing data based on account type and tax deductible flag
-- Business accounts with tax deductible transactions -> 'business'
-- Non-business accounts with tax deductible transactions -> 'personal'
-- Everything else -> 'none'
UPDATE transactions
SET tax_deduction_type = CASE
  WHEN is_tax_deductible = 1 AND account_id IN (
    SELECT id FROM accounts WHERE is_business_account = 1
  ) THEN 'business'
  WHEN is_tax_deductible = 1 THEN 'personal'
  ELSE 'none'
END;

