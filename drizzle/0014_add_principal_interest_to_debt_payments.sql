-- Add principal and interest amount tracking to debt payments
ALTER TABLE debt_payments ADD COLUMN principal_amount REAL DEFAULT 0;
ALTER TABLE debt_payments ADD COLUMN interest_amount REAL DEFAULT 0;

-- Update existing payments to set principal_amount = amount (assume no interest for old payments)
UPDATE debt_payments SET principal_amount = amount WHERE principal_amount IS NULL OR principal_amount = 0;
