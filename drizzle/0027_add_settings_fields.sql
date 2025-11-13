-- Add new fields to user_settings table for Settings Page functionality

-- Financial Preferences
ALTER TABLE user_settings ADD COLUMN fiscal_year_start INTEGER DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN default_account_id TEXT;
ALTER TABLE user_settings ADD COLUMN default_budget_method TEXT DEFAULT 'monthly';
ALTER TABLE user_settings ADD COLUMN budget_period TEXT DEFAULT 'monthly';
ALTER TABLE user_settings ADD COLUMN show_cents INTEGER DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN negative_number_format TEXT DEFAULT '-$100';
ALTER TABLE user_settings ADD COLUMN default_transaction_type TEXT DEFAULT 'expense';
ALTER TABLE user_settings ADD COLUMN auto_categorization INTEGER DEFAULT 1;

-- Privacy & Security
ALTER TABLE user_settings ADD COLUMN session_timeout INTEGER DEFAULT 30;
ALTER TABLE user_settings ADD COLUMN data_retention_years INTEGER DEFAULT 7;

-- Advanced
ALTER TABLE user_settings ADD COLUMN developer_mode INTEGER DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN enable_animations INTEGER DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN experimental_features INTEGER DEFAULT 0;
