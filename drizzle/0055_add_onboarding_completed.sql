-- Add onboarding_completed field to user_settings table
-- This field tracks whether the user has completed the onboarding flow
ALTER TABLE user_settings ADD COLUMN onboarding_completed INTEGER DEFAULT 0;

