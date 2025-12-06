-- Add budget schedule fields to user_household_preferences table
-- This enables users to set their budget cycle (weekly, biweekly, semi-monthly, monthly)

ALTER TABLE user_household_preferences ADD COLUMN budget_cycle_frequency TEXT DEFAULT 'monthly';
ALTER TABLE user_household_preferences ADD COLUMN budget_cycle_start_day INTEGER;
ALTER TABLE user_household_preferences ADD COLUMN budget_cycle_reference_date TEXT;
ALTER TABLE user_household_preferences ADD COLUMN budget_cycle_semi_monthly_days TEXT DEFAULT '[1, 15]';
ALTER TABLE user_household_preferences ADD COLUMN budget_period_rollover INTEGER DEFAULT 0;
ALTER TABLE user_household_preferences ADD COLUMN budget_period_manual_amount REAL;

-- Note: budget_cycle_frequency enum values: 'weekly', 'biweekly', 'semi-monthly', 'monthly'
-- budget_cycle_start_day: 0-6 for day of week (0=Sunday, 6=Saturday) - used for weekly/biweekly
-- budget_cycle_reference_date: ISO date string for biweekly calculation reference
-- budget_cycle_semi_monthly_days: JSON array like "[1, 15]" or "[5, 20]" for semi-monthly
-- budget_period_rollover: 0 = no rollover, 1 = rollover unused budget to next period
-- budget_period_manual_amount: Optional manual override for period budget amount

