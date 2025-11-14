-- Add missing budget_review_enabled column to notification_preferences table
ALTER TABLE notification_preferences ADD COLUMN budget_review_enabled INTEGER DEFAULT true;
