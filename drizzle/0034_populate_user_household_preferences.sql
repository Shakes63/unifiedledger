-- Migration: Populate user_household_preferences from existing user_settings and notification_preferences
-- Part of Phase 0: Settings Three-Tier Architecture
-- Created: 2025-11-14

-- For each user's household membership, create preference record with user's current settings
INSERT INTO user_household_preferences (
  id,
  user_id,
  household_id,
  date_format,
  number_format,
  default_account_id,
  first_day_of_week,
  show_cents,
  negative_number_format,
  default_transaction_type,
  theme,
  bill_reminders_enabled,
  bill_reminders_channels,
  budget_warnings_enabled,
  budget_warnings_channels,
  budget_exceeded_enabled,
  budget_exceeded_channels,
  budget_review_enabled,
  budget_review_channels,
  low_balance_enabled,
  low_balance_channels,
  savings_milestones_enabled,
  savings_milestones_channels,
  debt_milestones_enabled,
  debt_milestones_channels,
  weekly_summaries_enabled,
  weekly_summaries_channels,
  monthly_summaries_enabled,
  monthly_summaries_channels,
  created_at,
  updated_at
)
SELECT
  lower(hex(randomblob(16))) as id,
  hm.user_id,
  hm.household_id,
  COALESCE(us.date_format, 'MM/DD/YYYY'),
  COALESCE(us.number_format, 'en-US'),
  us.default_account_id,
  COALESCE(us.first_day_of_week, 'sunday'),
  COALESCE(us.show_cents, 1),
  COALESCE(us.negative_number_format, '-$100'),
  COALESCE(us.default_transaction_type, 'expense'),
  COALESCE(us.theme, 'dark-mode'),
  COALESCE(np.bill_reminder_enabled, 1),
  COALESCE(np.bill_reminder_channels, '["push","email"]'),
  COALESCE(np.budget_warning_enabled, 1),
  COALESCE(np.budget_warning_channels, '["push","email"]'),
  COALESCE(np.budget_exceeded_alert, 1),
  COALESCE(np.budget_exceeded_channels, '["push","email"]'),
  COALESCE(np.budget_review_enabled, 1),
  COALESCE(np.budget_review_channels, '["push","email"]'),
  COALESCE(np.low_balance_alert_enabled, 1),
  COALESCE(np.low_balance_channels, '["push","email"]'),
  COALESCE(np.savings_milestone_enabled, 1),
  COALESCE(np.savings_milestone_channels, '["push","email"]'),
  COALESCE(np.debt_milestone_enabled, 1),
  COALESCE(np.debt_milestone_channels, '["push","email"]'),
  COALESCE(np.weekly_summary_enabled, 0),
  COALESCE(np.weekly_summary_channels, '["email"]'),
  COALESCE(np.monthly_summary_enabled, 1),
  COALESCE(np.monthly_summary_channels, '["email"]'),
  datetime('now'),
  datetime('now')
FROM household_members hm
LEFT JOIN user_settings us ON us.user_id = hm.user_id
LEFT JOIN notification_preferences np ON np.user_id = hm.user_id
WHERE hm.is_active = 1;

-- Log migration completion
-- SELECT COUNT(*) as 'Records created in user_household_preferences' FROM user_household_preferences;
