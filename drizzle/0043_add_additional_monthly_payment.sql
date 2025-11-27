-- Add additional monthly payment field to debts table
-- This stores a committed extra payment amount beyond the minimum payment for each debt
-- Used for more accurate payoff projections and tracking actual vs planned extra payments

ALTER TABLE debts ADD COLUMN additional_monthly_payment REAL DEFAULT 0;

