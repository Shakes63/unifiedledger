-- Add new bill frequency options: one-time, weekly, biweekly
-- Add specific_due_date field for one-time bills

-- Add the new field for one-time bill specific dates
ALTER TABLE bills ADD COLUMN specific_due_date TEXT;

-- Create index for specific_due_date for faster queries on one-time bills
CREATE INDEX IF NOT EXISTS idx_bills_specific_due_date ON bills(specific_due_date) WHERE specific_due_date IS NOT NULL;
