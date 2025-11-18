-- Add combined_transfer_view field to user_household_preferences table
ALTER TABLE user_household_preferences 
ADD COLUMN combined_transfer_view INTEGER DEFAULT 1;

-- Update existing records to have combined view enabled (default behavior)
UPDATE user_household_preferences 
SET combined_transfer_view = 1 
WHERE combined_transfer_view IS NULL;



