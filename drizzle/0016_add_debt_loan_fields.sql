-- Add comprehensive loan tracking fields to debts table

-- Loan structure fields
ALTER TABLE debts ADD COLUMN loan_type TEXT DEFAULT 'revolving'; -- 'revolving' or 'installment'
ALTER TABLE debts ADD COLUMN loan_term_months INTEGER; -- Total term (60 for 5-year car loan, 360 for 30-year mortgage)
ALTER TABLE debts ADD COLUMN origination_date TEXT; -- When the loan started

-- Interest calculation fields
ALTER TABLE debts ADD COLUMN compounding_frequency TEXT DEFAULT 'monthly'; -- 'daily', 'monthly', 'quarterly', 'annually'
ALTER TABLE debts ADD COLUMN billing_cycle_days INTEGER DEFAULT 30; -- Days in billing cycle (varies for credit cards)

-- Credit card specific fields
ALTER TABLE debts ADD COLUMN last_statement_date TEXT; -- Last billing cycle date
ALTER TABLE debts ADD COLUMN last_statement_balance REAL; -- Balance on last statement

-- Update existing debts to have sensible defaults
UPDATE debts SET loan_type = 'revolving' WHERE loan_type IS NULL;
UPDATE debts SET compounding_frequency = 'monthly' WHERE compounding_frequency IS NULL;
UPDATE debts SET billing_cycle_days = 30 WHERE billing_cycle_days IS NULL;
