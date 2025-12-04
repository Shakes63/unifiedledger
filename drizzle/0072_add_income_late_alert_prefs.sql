-- Add income late alert preferences to notification_preferences table
ALTER TABLE notification_preferences ADD COLUMN income_late_alert_enabled INTEGER DEFAULT 1;
ALTER TABLE notification_preferences ADD COLUMN income_late_alert_days INTEGER DEFAULT 1;
ALTER TABLE notification_preferences ADD COLUMN income_late_channels TEXT DEFAULT '["push"]';

