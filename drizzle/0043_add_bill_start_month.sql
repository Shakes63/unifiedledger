-- Add startMonth column for non-monthly bill scheduling
-- This allows quarterly, semi-annual, and annual bills to specify which month their cycle starts
-- Values: 0-11 (January=0, December=11)
-- Only used for: quarterly, semi-annual, annual frequencies
-- Monthly, weekly, biweekly, and one-time bills will have NULL for this column

ALTER TABLE bills ADD COLUMN start_month INTEGER;

