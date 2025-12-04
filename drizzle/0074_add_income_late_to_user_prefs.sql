-- Migration: Add income late alerts to user_household_preferences
-- This was missing from Phase 16 - the fields were added to notification_preferences
-- but the NotificationsTab component expects them in user_household_preferences

ALTER TABLE user_household_preferences ADD COLUMN income_late_enabled INTEGER DEFAULT 1;
ALTER TABLE user_household_preferences ADD COLUMN income_late_channels TEXT DEFAULT '["push"]';

