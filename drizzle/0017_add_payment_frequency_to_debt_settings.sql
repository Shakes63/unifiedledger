-- Add payment frequency field to debt settings table
-- Supports 'monthly' (12 payments/year) and 'biweekly' (26 payments/year)

ALTER TABLE debt_settings ADD COLUMN payment_frequency TEXT DEFAULT 'monthly';

-- Update any existing records to use monthly as default (backwards compatibility)
UPDATE debt_settings SET payment_frequency = 'monthly' WHERE payment_frequency IS NULL;
