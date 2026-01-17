-- Add include_in_discretionary column to accounts table
-- Used by Paycheck Balance Widget to determine which accounts to include in discretionary calculations

ALTER TABLE accounts ADD COLUMN include_in_discretionary INTEGER DEFAULT 1;

-- Set smart defaults based on account type:
-- Checking and Cash accounts: include by default (where spending money typically lives)
-- Savings, Credit, Line of Credit, Investment: exclude by default (not typically discretionary spending)
UPDATE accounts SET include_in_discretionary = 0 WHERE type IN ('savings', 'credit', 'line_of_credit', 'investment');
UPDATE accounts SET include_in_discretionary = 1 WHERE type IN ('checking', 'cash');

