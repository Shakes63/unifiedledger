-- Migration: Add multi-level tax rate columns to sales_tax_settings
-- Allows separate tracking of State, County, City, and Special District tax rates

-- Add multi-level tax rate columns
ALTER TABLE sales_tax_settings ADD COLUMN state_rate REAL DEFAULT 0;
ALTER TABLE sales_tax_settings ADD COLUMN county_rate REAL DEFAULT 0;
ALTER TABLE sales_tax_settings ADD COLUMN city_rate REAL DEFAULT 0;
ALTER TABLE sales_tax_settings ADD COLUMN special_district_rate REAL DEFAULT 0;

-- Add jurisdiction name columns for display
ALTER TABLE sales_tax_settings ADD COLUMN state_name TEXT;
ALTER TABLE sales_tax_settings ADD COLUMN county_name TEXT;
ALTER TABLE sales_tax_settings ADD COLUMN city_name TEXT;
ALTER TABLE sales_tax_settings ADD COLUMN special_district_name TEXT;

-- Migrate existing defaultRate to stateRate for backward compatibility
-- Users with a single rate will have it moved to the state level
UPDATE sales_tax_settings SET state_rate = default_rate WHERE default_rate > 0;

