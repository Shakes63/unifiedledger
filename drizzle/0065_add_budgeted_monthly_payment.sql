-- Phase 7: Budget Integration
-- Add budgeted_monthly_payment to accounts and bills for manual debt budget mode

-- Add to accounts (for credit cards and lines of credit)
ALTER TABLE accounts ADD COLUMN budgeted_monthly_payment REAL DEFAULT NULL;

-- Add to bills (for debt bills)
ALTER TABLE bills ADD COLUMN budgeted_monthly_payment REAL DEFAULT NULL;

