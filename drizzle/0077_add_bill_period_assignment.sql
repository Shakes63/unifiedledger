-- Add budget period assignment field to bills table
-- NULL = auto (based on due date), 1 = always period 1, 2 = always period 2, etc.
ALTER TABLE bills ADD COLUMN budget_period_assignment INTEGER DEFAULT NULL;

-- Add budget period override field to bill_instances table
-- NULL = use bill default, otherwise specific period number
ALTER TABLE bill_instances ADD COLUMN budget_period_override INTEGER DEFAULT NULL;
