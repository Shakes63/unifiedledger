-- Add per-notification-type channel preferences to notification_preferences table
-- Channels are stored as JSON arrays, e.g., ["push", "email", "sms", "slack"]
-- This makes the system extendable for future notification channels

ALTER TABLE notification_preferences ADD COLUMN bill_reminder_channels TEXT DEFAULT '["push"]';
ALTER TABLE notification_preferences ADD COLUMN budget_warning_channels TEXT DEFAULT '["push"]';
ALTER TABLE notification_preferences ADD COLUMN budget_exceeded_channels TEXT DEFAULT '["push"]';
ALTER TABLE notification_preferences ADD COLUMN budget_review_channels TEXT DEFAULT '["push"]';
ALTER TABLE notification_preferences ADD COLUMN low_balance_channels TEXT DEFAULT '["push"]';
ALTER TABLE notification_preferences ADD COLUMN savings_milestone_channels TEXT DEFAULT '["push"]';
ALTER TABLE notification_preferences ADD COLUMN debt_milestone_channels TEXT DEFAULT '["push"]';
ALTER TABLE notification_preferences ADD COLUMN weekly_summary_channels TEXT DEFAULT '["push"]';
ALTER TABLE notification_preferences ADD COLUMN monthly_summary_channels TEXT DEFAULT '["push"]';
