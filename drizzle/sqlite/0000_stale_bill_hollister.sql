CREATE TABLE `account_balance_history` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`balance` real NOT NULL,
	`credit_limit` real,
	`available_credit` real,
	`utilization_percent` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_account_balance_history_account` ON `account_balance_history` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_account_balance_history_user` ON `account_balance_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_account_balance_history_household` ON `account_balance_history` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_account_balance_history_date` ON `account_balance_history` (`snapshot_date`);--> statement-breakpoint
CREATE INDEX `idx_account_balance_history_account_date` ON `account_balance_history` (`account_id`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `account_deletion_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reason` text,
	`scheduled_deletion_date` text NOT NULL,
	`status` text DEFAULT 'pending',
	`requested_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`cancelled_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`bank_name` text NOT NULL,
	`account_number_last4` text,
	`current_balance` real DEFAULT 0,
	`available_balance` real,
	`credit_limit` real,
	`is_active` integer DEFAULT true,
	`is_business_account` integer DEFAULT false,
	`enable_sales_tax` integer DEFAULT false,
	`enable_tax_deductions` integer DEFAULT false,
	`color` text DEFAULT '#3b82f6',
	`icon` text DEFAULT 'wallet',
	`sort_order` integer DEFAULT 0,
	`usage_count` integer DEFAULT 0,
	`last_used_at` text,
	`statement_balance` real,
	`statement_date` text,
	`statement_due_date` text,
	`minimum_payment_amount` real,
	`last_statement_updated` text,
	`interest_rate` real,
	`minimum_payment_percent` real,
	`minimum_payment_floor` real,
	`additional_monthly_payment` real,
	`is_secured` integer DEFAULT false,
	`secured_asset` text,
	`draw_period_end_date` text,
	`repayment_period_end_date` text,
	`interest_type` text DEFAULT 'fixed',
	`prime_rate_margin` real,
	`annual_fee` real,
	`annual_fee_month` integer,
	`annual_fee_bill_id` text,
	`auto_create_payment_bill` integer DEFAULT true,
	`include_in_payoff_strategy` integer DEFAULT true,
	`budgeted_monthly_payment` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_user` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_accounts_household` ON `accounts` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_accounts_user_household` ON `accounts` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_accounts_user_usage` ON `accounts` (`user_id`,`usage_count`);--> statement-breakpoint
CREATE INDEX `idx_accounts_user_active` ON `accounts` (`user_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_accounts_interest_rate` ON `accounts` (`interest_rate`);--> statement-breakpoint
CREATE INDEX `idx_accounts_include_in_strategy` ON `accounts` (`include_in_payoff_strategy`);--> statement-breakpoint
CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_household_activity` ON `activity_log` (`household_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `backup_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`backup_settings_id` text NOT NULL,
	`filename` text NOT NULL,
	`file_size` integer NOT NULL,
	`format` text DEFAULT 'json',
	`status` text DEFAULT 'pending',
	`error_message` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_backup_history_user` ON `backup_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_backup_history_household` ON `backup_history` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_backup_history_created` ON `backup_history` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_backup_history_status` ON `backup_history` (`status`);--> statement-breakpoint
CREATE INDEX `idx_backup_history_user_created` ON `backup_history` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_backup_history_user_household_created` ON `backup_history` (`user_id`,`household_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `backup_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`enabled` integer DEFAULT false,
	`frequency` text DEFAULT 'weekly',
	`format` text DEFAULT 'json',
	`retention_count` integer DEFAULT 10,
	`email_backups` integer DEFAULT false,
	`last_backup_at` text,
	`next_backup_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_backup_settings_user` ON `backup_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_backup_settings_household` ON `backup_settings` (`user_id`,`household_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_backup_settings_user_household_unique` ON `backup_settings` (`user_id`,`household_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`city` text,
	`region` text,
	`country` text,
	`country_code` text,
	`user_id` text NOT NULL,
	`last_activity_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`remember_me` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`pending_email` text,
	`image` text,
	`image_updated_at` integer,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`two_factor_secret` text,
	`two_factor_backup_codes` text,
	`two_factor_verified_at` integer,
	`is_application_owner` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bill_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`bill_id` text NOT NULL,
	`due_date` text NOT NULL,
	`expected_amount` real NOT NULL,
	`actual_amount` real,
	`paid_date` text,
	`transaction_id` text,
	`status` text DEFAULT 'pending',
	`days_late` integer DEFAULT 0,
	`late_fee` real DEFAULT 0,
	`is_manual_override` integer DEFAULT false,
	`notes` text,
	`paid_amount` real DEFAULT 0,
	`remaining_amount` real,
	`payment_status` text DEFAULT 'unpaid',
	`principal_paid` real DEFAULT 0,
	`interest_paid` real DEFAULT 0,
	`budget_period_override` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bill_instances_unique` ON `bill_instances` (`bill_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_bill_instances_user` ON `bill_instances` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_instances_household` ON `bill_instances` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_instances_user_household` ON `bill_instances` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_instances_payment_status` ON `bill_instances` (`payment_status`);--> statement-breakpoint
CREATE TABLE `bill_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text,
	`account_id` text,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`percentage` integer NOT NULL,
	`milestone_balance` real NOT NULL,
	`achieved_at` text,
	`notification_sent_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_bill_milestones_bill` ON `bill_milestones` (`bill_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_milestones_account` ON `bill_milestones` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_milestones_user` ON `bill_milestones` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_milestones_household` ON `bill_milestones` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_milestones_percentage` ON `bill_milestones` (`percentage`);--> statement-breakpoint
CREATE TABLE `bill_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`bill_instance_id` text,
	`transaction_id` text,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`amount` real NOT NULL,
	`principal_amount` real,
	`interest_amount` real,
	`payment_date` text NOT NULL,
	`payment_method` text DEFAULT 'manual',
	`linked_account_id` text,
	`balance_before_payment` real,
	`balance_after_payment` real,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_bill_payments_bill` ON `bill_payments` (`bill_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_payments_instance` ON `bill_payments` (`bill_instance_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_payments_transaction` ON `bill_payments` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_payments_user` ON `bill_payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_payments_household` ON `bill_payments` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_payments_date` ON `bill_payments` (`payment_date`);--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`category_id` text,
	`merchant_id` text,
	`debt_id` text,
	`expected_amount` real NOT NULL,
	`due_date` integer NOT NULL,
	`frequency` text DEFAULT 'monthly',
	`specific_due_date` text,
	`start_month` integer,
	`is_variable_amount` integer DEFAULT false,
	`amount_tolerance` real DEFAULT 5,
	`payee_patterns` text,
	`account_id` text,
	`is_active` integer DEFAULT true,
	`auto_mark_paid` integer DEFAULT true,
	`notes` text,
	`bill_type` text DEFAULT 'expense',
	`bill_classification` text,
	`classification_subcategory` text,
	`linked_account_id` text,
	`amount_source` text DEFAULT 'fixed',
	`charged_to_account_id` text,
	`is_autopay_enabled` integer DEFAULT false,
	`autopay_account_id` text,
	`autopay_amount_type` text,
	`autopay_fixed_amount` real,
	`autopay_days_before` integer DEFAULT 0,
	`is_debt` integer DEFAULT false,
	`original_balance` real,
	`remaining_balance` real,
	`bill_interest_rate` real,
	`interest_type` text DEFAULT 'none',
	`minimum_payment` real,
	`bill_additional_monthly_payment` real,
	`debt_type` text,
	`bill_color` text,
	`include_in_payoff_strategy` integer DEFAULT true,
	`budgeted_monthly_payment` real,
	`is_interest_tax_deductible` integer DEFAULT false,
	`tax_deduction_type` text DEFAULT 'none',
	`tax_deduction_limit` real,
	`budget_period_assignment` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_bills_user` ON `bills` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_bills_household` ON `bills` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_bills_user_household` ON `bills` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_bills_specific_due_date` ON `bills` (`specific_due_date`);--> statement-breakpoint
CREATE INDEX `idx_bills_bill_type` ON `bills` (`bill_type`);--> statement-breakpoint
CREATE INDEX `idx_bills_is_debt` ON `bills` (`is_debt`);--> statement-breakpoint
CREATE INDEX `idx_bills_linked_account` ON `bills` (`linked_account_id`);--> statement-breakpoint
CREATE INDEX `idx_bills_charged_to_account` ON `bills` (`charged_to_account_id`);--> statement-breakpoint
CREATE INDEX `idx_bills_classification` ON `bills` (`bill_classification`);--> statement-breakpoint
CREATE INDEX `idx_bills_include_in_strategy` ON `bills` (`include_in_payoff_strategy`);--> statement-breakpoint
CREATE TABLE `budget_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`monthly_budget` real DEFAULT 0,
	`due_date` integer,
	`is_active` integer DEFAULT true,
	`is_tax_deductible` integer DEFAULT false,
	`is_business_category` integer DEFAULT false,
	`sort_order` integer DEFAULT 0,
	`usage_count` integer DEFAULT 0,
	`last_used_at` text,
	`income_frequency` text DEFAULT 'variable',
	`is_system_category` integer DEFAULT false,
	`is_interest_category` integer DEFAULT false,
	`rollover_enabled` integer DEFAULT false,
	`rollover_balance` real DEFAULT 0,
	`rollover_limit` real,
	`parent_id` text,
	`is_budget_group` integer DEFAULT false,
	`target_allocation` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_budget_categories_user` ON `budget_categories` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_categories_household` ON `budget_categories` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_categories_user_household` ON `budget_categories` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_categories_user_type` ON `budget_categories` (`user_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_budget_categories_user_usage` ON `budget_categories` (`user_id`,`usage_count`);--> statement-breakpoint
CREATE INDEX `idx_budget_categories_user_active` ON `budget_categories` (`user_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_budget_categories_system` ON `budget_categories` (`is_system_category`);--> statement-breakpoint
CREATE INDEX `idx_budget_categories_rollover` ON `budget_categories` (`rollover_enabled`);--> statement-breakpoint
CREATE INDEX `idx_budget_categories_parent` ON `budget_categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_categories_budget_group` ON `budget_categories` (`is_budget_group`);--> statement-breakpoint
CREATE TABLE `budget_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`total_income` real DEFAULT 0,
	`total_variable_expenses` real DEFAULT 0,
	`total_monthly_bills` real DEFAULT 0,
	`total_savings` real DEFAULT 0,
	`total_debt_payments` real DEFAULT 0,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_budget_periods_unique` ON `budget_periods` (`user_id`,`month`,`year`);--> statement-breakpoint
CREATE TABLE `budget_rollover_history` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`household_id` text NOT NULL,
	`month` text NOT NULL,
	`previous_balance` real DEFAULT 0 NOT NULL,
	`monthly_budget` real DEFAULT 0 NOT NULL,
	`actual_spent` real DEFAULT 0 NOT NULL,
	`rollover_amount` real DEFAULT 0 NOT NULL,
	`new_balance` real DEFAULT 0 NOT NULL,
	`rollover_limit` real,
	`was_capped` integer DEFAULT false,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_rollover_history_category` ON `budget_rollover_history` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_rollover_history_household` ON `budget_rollover_history` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_rollover_history_month` ON `budget_rollover_history` (`month`);--> statement-breakpoint
CREATE INDEX `idx_rollover_history_category_month` ON `budget_rollover_history` (`category_id`,`month`);--> statement-breakpoint
CREATE TABLE `calendar_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`provider` text NOT NULL,
	`calendar_id` text,
	`calendar_name` text,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`token_expires_at` text,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_connections_user` ON `calendar_connections` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_connections_household` ON `calendar_connections` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_connections_user_household` ON `calendar_connections` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_connections_provider` ON `calendar_connections` (`provider`);--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`external_event_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`event_date` text NOT NULL,
	`sync_mode` text NOT NULL,
	`event_title` text,
	`last_synced_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_events_user` ON `calendar_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_events_household` ON `calendar_events` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_events_connection` ON `calendar_events` (`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_events_source` ON `calendar_events` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_events_external` ON `calendar_events` (`external_event_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_events_date` ON `calendar_events` (`event_date`);--> statement-breakpoint
CREATE TABLE `calendar_sync_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`sync_mode` text DEFAULT 'direct',
	`sync_bills` integer DEFAULT true,
	`sync_savings_milestones` integer DEFAULT true,
	`sync_debt_milestones` integer DEFAULT true,
	`sync_payoff_dates` integer DEFAULT true,
	`sync_goal_target_dates` integer DEFAULT true,
	`reminder_minutes` integer DEFAULT 1440,
	`last_full_sync_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_sync_settings_user` ON `calendar_sync_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_sync_settings_household` ON `calendar_sync_settings` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_sync_settings_user_household` ON `calendar_sync_settings` (`user_id`,`household_id`);--> statement-breakpoint
CREATE TABLE `categorization_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`category_id` text,
	`description` text,
	`priority` integer DEFAULT 100,
	`is_active` integer DEFAULT true,
	`conditions` text NOT NULL,
	`actions` text,
	`match_count` integer DEFAULT 0,
	`last_matched_at` text,
	`test_results` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_categorization_rules_user` ON `categorization_rules` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_categorization_rules_household` ON `categorization_rules` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_categorization_rules_user_household` ON `categorization_rules` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_categorization_rules_priority` ON `categorization_rules` (`priority`);--> statement-breakpoint
CREATE TABLE `category_tax_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`budget_category_id` text NOT NULL,
	`tax_category_id` text NOT NULL,
	`tax_year` integer NOT NULL,
	`allocation_percentage` real DEFAULT 100,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_category_tax_mappings_user` ON `category_tax_mappings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_category_tax_mappings_budget_cat` ON `category_tax_mappings` (`budget_category_id`);--> statement-breakpoint
CREATE INDEX `idx_category_tax_mappings_tax_cat` ON `category_tax_mappings` (`tax_category_id`);--> statement-breakpoint
CREATE INDEX `idx_category_tax_mappings_year` ON `category_tax_mappings` (`tax_year`);--> statement-breakpoint
CREATE INDEX `idx_category_tax_mappings_user_year` ON `category_tax_mappings` (`user_id`,`tax_year`);--> statement-breakpoint
CREATE TABLE `credit_limit_history` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`previous_limit` real,
	`new_limit` real NOT NULL,
	`change_date` text NOT NULL,
	`change_reason` text DEFAULT 'user_update',
	`utilization_before` real,
	`utilization_after` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_credit_limit_history_account` ON `credit_limit_history` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_credit_limit_history_user` ON `credit_limit_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_credit_limit_history_household` ON `credit_limit_history` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_credit_limit_history_change_date` ON `credit_limit_history` (`change_date`);--> statement-breakpoint
CREATE TABLE `custom_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`custom_field_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`value` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_custom_field_values_unique` ON `custom_field_values` (`custom_field_id`,`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_custom_field_values_user` ON `custom_field_values` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_custom_field_values_field` ON `custom_field_values` (`custom_field_id`);--> statement-breakpoint
CREATE INDEX `idx_custom_field_values_transaction` ON `custom_field_values` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`is_required` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`sort_order` integer DEFAULT 0,
	`options` text,
	`default_value` text,
	`placeholder` text,
	`validation_pattern` text,
	`usage_count` integer DEFAULT 0,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_custom_fields_user` ON `custom_fields` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_custom_fields_user_name` ON `custom_fields` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_custom_fields_user_active` ON `custom_fields` (`user_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_custom_fields_user_usage` ON `custom_fields` (`user_id`,`usage_count`);--> statement-breakpoint
CREATE TABLE `data_export_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending',
	`export_format` text DEFAULT 'json',
	`file_url` text,
	`file_size` integer,
	`expires_at` text,
	`requested_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `debt_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`amount` real NOT NULL,
	`principal_amount` real DEFAULT 0,
	`interest_amount` real DEFAULT 0,
	`payment_date` text NOT NULL,
	`transaction_id` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_debt_payments_user` ON `debt_payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payments_household` ON `debt_payments` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payments_user_household` ON `debt_payments` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payments_debt` ON `debt_payments` (`debt_id`);--> statement-breakpoint
CREATE TABLE `debt_payoff_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`percentage` integer NOT NULL,
	`milestone_balance` real NOT NULL,
	`achieved_at` text,
	`notification_sent_at` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_debt_payoff_milestones_user` ON `debt_payoff_milestones` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payoff_milestones_household` ON `debt_payoff_milestones` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payoff_milestones_user_household` ON `debt_payoff_milestones` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payoff_milestones_debt` ON `debt_payoff_milestones` (`debt_id`);--> statement-breakpoint
CREATE TABLE `debt_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`extra_monthly_payment` real DEFAULT 0,
	`preferred_method` text DEFAULT 'avalanche',
	`payment_frequency` text DEFAULT 'monthly',
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_debt_settings_user` ON `debt_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_settings_household` ON `debt_settings` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_settings_user_household` ON `debt_settings` (`user_id`,`household_id`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`creditor_name` text NOT NULL,
	`original_amount` real NOT NULL,
	`remaining_balance` real NOT NULL,
	`minimum_payment` real,
	`additional_monthly_payment` real DEFAULT 0,
	`interest_rate` real DEFAULT 0,
	`interest_type` text DEFAULT 'none',
	`account_id` text,
	`category_id` text,
	`type` text DEFAULT 'other',
	`color` text DEFAULT '#ef4444',
	`icon` text DEFAULT 'credit-card',
	`start_date` text NOT NULL,
	`target_payoff_date` text,
	`status` text DEFAULT 'active',
	`priority` integer DEFAULT 0,
	`loan_type` text DEFAULT 'revolving',
	`loan_term_months` integer,
	`origination_date` text,
	`compounding_frequency` text DEFAULT 'monthly',
	`billing_cycle_days` integer DEFAULT 30,
	`last_statement_date` text,
	`last_statement_balance` real,
	`credit_limit` real,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_debts_user` ON `debts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_household` ON `debts` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_user_household` ON `debts` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_status` ON `debts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_debts_category` ON `debts` (`category_id`);--> statement-breakpoint
CREATE TABLE `household_activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text,
	`user_id` text NOT NULL,
	`user_name` text,
	`activity_type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`entity_name` text,
	`description` text,
	`metadata` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_activity_log_user` ON `household_activity_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_household` ON `household_activity_log` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_type` ON `household_activity_log` (`activity_type`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_created_at` ON `household_activity_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `household_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`invited_email` text NOT NULL,
	`invited_by` text NOT NULL,
	`role` text DEFAULT 'member',
	`invitation_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`status` text DEFAULT 'pending',
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_invitations_invitation_token_unique` ON `household_invitations` (`invitation_token`);--> statement-breakpoint
CREATE INDEX `idx_household_invitations` ON `household_invitations` (`household_id`);--> statement-breakpoint
CREATE TABLE `household_members` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text,
	`role` text DEFAULT 'member',
	`joined_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`invited_by` text,
	`is_active` integer DEFAULT true,
	`is_favorite` integer DEFAULT false,
	`custom_permissions` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_household_members_unique` ON `household_members` (`household_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `household_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`currency` text DEFAULT 'USD',
	`currency_symbol` text DEFAULT '$',
	`time_format` text DEFAULT '12h',
	`fiscal_year_start` integer DEFAULT 1,
	`default_budget_method` text DEFAULT 'monthly',
	`budget_period` text DEFAULT 'monthly',
	`auto_categorization` integer DEFAULT true,
	`data_retention_years` integer DEFAULT 7,
	`auto_cleanup_enabled` integer DEFAULT false,
	`cache_strategy` text DEFAULT 'normal',
	`debt_strategy_enabled` integer DEFAULT false,
	`debt_payoff_method` text DEFAULT 'avalanche',
	`extra_monthly_payment` real DEFAULT 0,
	`payment_frequency` text DEFAULT 'monthly',
	`allow_negative_rollover` integer DEFAULT false,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_settings_household_id_unique` ON `household_settings` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_household_settings_household` ON `household_settings` (`household_id`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE TABLE `import_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text,
	`template_id` text,
	`filename` text NOT NULL,
	`file_size` integer,
	`rows_total` integer NOT NULL,
	`rows_imported` integer NOT NULL,
	`rows_skipped` integer NOT NULL,
	`rows_duplicates` integer NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`import_settings` text,
	`source_type` text,
	`statement_info` text,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`completed_at` text,
	`rolled_back_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_import_history_user` ON `import_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_import_history_user_created` ON `import_history` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `import_staging` (
	`id` text PRIMARY KEY NOT NULL,
	`import_history_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw_data` text NOT NULL,
	`mapped_data` text NOT NULL,
	`duplicate_of` text,
	`duplicate_score` real,
	`status` text NOT NULL,
	`validation_errors` text,
	`cc_transaction_type` text,
	`potential_transfer_id` text,
	`transfer_match_confidence` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_import_staging_history` ON `import_staging` (`import_history_id`);--> statement-breakpoint
CREATE INDEX `idx_import_staging_cc_type` ON `import_staging` (`cc_transaction_type`);--> statement-breakpoint
CREATE INDEX `idx_import_staging_transfer` ON `import_staging` (`potential_transfer_id`);--> statement-breakpoint
CREATE TABLE `import_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text,
	`name` text NOT NULL,
	`description` text,
	`column_mappings` text NOT NULL,
	`date_format` text NOT NULL,
	`delimiter` text DEFAULT ',',
	`has_header_row` integer DEFAULT true,
	`skip_rows` integer DEFAULT 0,
	`default_account_id` text,
	`is_favorite` integer DEFAULT false,
	`usage_count` integer DEFAULT 0,
	`last_used_at` text,
	`source_type` text DEFAULT 'auto',
	`issuer` text,
	`amount_sign_convention` text DEFAULT 'standard',
	`transaction_type_patterns` text,
	`statement_info_config` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_import_templates_user` ON `import_templates` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_import_templates_user_household` ON `import_templates` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_import_templates_source_type` ON `import_templates` (`source_type`);--> statement-breakpoint
CREATE TABLE `interest_deductions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`bill_id` text NOT NULL,
	`bill_payment_id` text NOT NULL,
	`tax_year` integer NOT NULL,
	`deduction_type` text NOT NULL,
	`interest_amount` real NOT NULL,
	`deductible_amount` real NOT NULL,
	`limit_applied` real,
	`bill_limit_applied` integer DEFAULT false,
	`annual_limit_applied` integer DEFAULT false,
	`payment_date` text NOT NULL,
	`tax_category_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_interest_deductions_user` ON `interest_deductions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_interest_deductions_household` ON `interest_deductions` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_interest_deductions_year` ON `interest_deductions` (`tax_year`);--> statement-breakpoint
CREATE INDEX `idx_interest_deductions_type` ON `interest_deductions` (`deduction_type`);--> statement-breakpoint
CREATE INDEX `idx_interest_deductions_bill` ON `interest_deductions` (`bill_id`);--> statement-breakpoint
CREATE INDEX `idx_interest_deductions_payment` ON `interest_deductions` (`bill_payment_id`);--> statement-breakpoint
CREATE INDEX `idx_interest_deductions_user_year_type` ON `interest_deductions` (`user_id`,`tax_year`,`deduction_type`);--> statement-breakpoint
CREATE TABLE `merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`category_id` text,
	`is_sales_tax_exempt` integer DEFAULT false,
	`usage_count` integer DEFAULT 1,
	`last_used_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`total_spent` real DEFAULT 0,
	`average_transaction` real DEFAULT 0,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_merchants_user_household_normalized` ON `merchants` (`user_id`,`household_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `idx_merchants_user` ON `merchants` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_merchants_household` ON `merchants` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_merchants_user_household` ON `merchants` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_merchants_user_usage` ON `merchants` (`user_id`,`usage_count`);--> statement-breakpoint
CREATE INDEX `idx_merchants_user_lastused` ON `merchants` (`user_id`,`last_used_at`);--> statement-breakpoint
CREATE TABLE `non_monthly_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`january_due` integer,
	`january_amount` real DEFAULT 0,
	`february_due` integer,
	`february_amount` real DEFAULT 0,
	`march_due` integer,
	`march_amount` real DEFAULT 0,
	`april_due` integer,
	`april_amount` real DEFAULT 0,
	`may_due` integer,
	`may_amount` real DEFAULT 0,
	`june_due` integer,
	`june_amount` real DEFAULT 0,
	`july_due` integer,
	`july_amount` real DEFAULT 0,
	`august_due` integer,
	`august_amount` real DEFAULT 0,
	`september_due` integer,
	`september_amount` real DEFAULT 0,
	`october_due` integer,
	`october_amount` real DEFAULT 0,
	`november_due` integer,
	`november_amount` real DEFAULT 0,
	`december_due` integer,
	`december_amount` real DEFAULT 0,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_non_monthly_bills_user` ON `non_monthly_bills` (`user_id`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text,
	`bill_reminder_enabled` integer DEFAULT true,
	`bill_reminder_days_before` integer DEFAULT 3,
	`bill_reminder_on_due_date` integer DEFAULT true,
	`bill_overdue_reminder` integer DEFAULT true,
	`bill_reminder_channels` text DEFAULT '["push"]',
	`budget_warning_enabled` integer DEFAULT true,
	`budget_warning_threshold` integer DEFAULT 80,
	`budget_exceeded_alert` integer DEFAULT true,
	`budget_warning_channels` text DEFAULT '["push"]',
	`budget_exceeded_channels` text DEFAULT '["push"]',
	`budget_review_enabled` integer DEFAULT true,
	`budget_review_channels` text DEFAULT '["push"]',
	`low_balance_alert_enabled` integer DEFAULT true,
	`low_balance_threshold` real DEFAULT 100,
	`low_balance_channels` text DEFAULT '["push"]',
	`savings_milestone_enabled` integer DEFAULT true,
	`savings_milestone_channels` text DEFAULT '["push"]',
	`debt_milestone_enabled` integer DEFAULT true,
	`debt_milestone_channels` text DEFAULT '["push"]',
	`weekly_summary_enabled` integer DEFAULT true,
	`weekly_summary_day` text DEFAULT 'sunday',
	`weekly_summary_channels` text DEFAULT '["push"]',
	`monthly_summary_enabled` integer DEFAULT true,
	`monthly_summary_day` integer DEFAULT 1,
	`monthly_summary_channels` text DEFAULT '["push"]',
	`income_late_alert_enabled` integer DEFAULT true,
	`income_late_alert_days` integer DEFAULT 1,
	`income_late_channels` text DEFAULT '["push"]',
	`push_notifications_enabled` integer DEFAULT true,
	`email_notifications_enabled` integer DEFAULT false,
	`email_address` text,
	`quiet_hours_start` text,
	`quiet_hours_end` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_user_id_unique` ON `notification_preferences` (`user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text,
	`type` text NOT NULL,
	`priority` text DEFAULT 'normal',
	`title` text NOT NULL,
	`message` text NOT NULL,
	`action_url` text,
	`entity_type` text,
	`entity_id` text,
	`is_read` integer DEFAULT false,
	`is_dismissed` integer DEFAULT false,
	`is_actionable` integer DEFAULT true,
	`action_label` text,
	`scheduled_for` text,
	`sent_at` text,
	`read_at` text,
	`dismissed_at` text,
	`expires_at` text,
	`metadata` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_user_notifications` ON `notifications` (`user_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_notifications` ON `notifications` (`scheduled_for`,`sent_at`);--> statement-breakpoint
CREATE TABLE `oauth_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`enabled` integer DEFAULT true,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_settings_provider_id_unique` ON `oauth_settings` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_settings_provider` ON `oauth_settings` (`provider_id`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh_key` text NOT NULL,
	`auth_key` text NOT NULL,
	`user_agent` text,
	`device_name` text,
	`is_active` integer DEFAULT true,
	`last_used_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `quarterly_filing_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tax_year` integer NOT NULL,
	`quarter` integer NOT NULL,
	`due_date` text NOT NULL,
	`submitted_date` text,
	`status` text DEFAULT 'pending',
	`total_sales_amount` real DEFAULT 0,
	`total_tax_amount` real DEFAULT 0,
	`amount_paid` real DEFAULT 0,
	`balance_due` real DEFAULT 0,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_quarterly_filing_user` ON `quarterly_filing_records` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_quarterly_filing_user_year` ON `quarterly_filing_records` (`user_id`,`tax_year`);--> statement-breakpoint
CREATE INDEX `idx_quarterly_filing_status` ON `quarterly_filing_records` (`status`);--> statement-breakpoint
CREATE INDEX `idx_quarterly_filing_due_date` ON `quarterly_filing_records` (`due_date`);--> statement-breakpoint
CREATE TABLE `resource_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`visibility` text DEFAULT 'shared',
	`can_view` text DEFAULT 'all',
	`can_edit` text DEFAULT 'all',
	`allowed_user_ids` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_resource_permissions_unique` ON `resource_permissions` (`household_id`,`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `rule_execution_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`applied_category_id` text,
	`applied_actions` text,
	`matched` integer NOT NULL,
	`executed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_rule_execution_user` ON `rule_execution_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_rule_execution_log_household` ON `rule_execution_log` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_rule_execution_log_user_household` ON `rule_execution_log` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_rule_execution_rule` ON `rule_execution_log` (`rule_id`);--> statement-breakpoint
CREATE INDEX `idx_rule_execution_transaction` ON `rule_execution_log` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `sales_tax_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`rate` real NOT NULL,
	`description` text,
	`is_default` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_sales_tax_categories_user` ON `sales_tax_categories` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_categories_user_active` ON `sales_tax_categories` (`user_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `sales_tax_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`default_rate` real DEFAULT 0 NOT NULL,
	`jurisdiction` text,
	`fiscal_year_start` text,
	`filing_frequency` text DEFAULT 'quarterly',
	`enable_tracking` integer DEFAULT true,
	`state_rate` real DEFAULT 0,
	`county_rate` real DEFAULT 0,
	`city_rate` real DEFAULT 0,
	`special_district_rate` real DEFAULT 0,
	`state_name` text,
	`county_name` text,
	`city_name` text,
	`special_district_name` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_tax_settings_user_id_unique` ON `sales_tax_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_settings_user` ON `sales_tax_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `sales_tax_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`tax_category_id` text NOT NULL,
	`tax_year` integer NOT NULL,
	`quarter` integer NOT NULL,
	`sale_amount` real NOT NULL,
	`tax_rate` real NOT NULL,
	`tax_amount` real NOT NULL,
	`reported_status` text DEFAULT 'pending',
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_user` ON `sales_tax_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_account` ON `sales_tax_transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_transaction` ON `sales_tax_transactions` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_quarter` ON `sales_tax_transactions` (`quarter`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_status` ON `sales_tax_transactions` (`reported_status`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_user_quarter` ON `sales_tax_transactions` (`user_id`,`tax_year`,`quarter`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_user_account_quarter` ON `sales_tax_transactions` (`user_id`,`account_id`,`tax_year`,`quarter`);--> statement-breakpoint
CREATE TABLE `saved_search_filters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`filters` text NOT NULL,
	`is_default` integer DEFAULT false,
	`usage_count` integer DEFAULT 0,
	`last_used_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_saved_search_filters_user` ON `saved_search_filters` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_saved_search_filters_user_default` ON `saved_search_filters` (`user_id`,`is_default`);--> statement-breakpoint
CREATE TABLE `savings_goal_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_transaction` ON `savings_goal_contributions` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_goal` ON `savings_goal_contributions` (`goal_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_user_household` ON `savings_goal_contributions` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_goal_created` ON `savings_goal_contributions` (`goal_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `savings_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`target_amount` real NOT NULL,
	`current_amount` real DEFAULT 0,
	`account_id` text,
	`category` text DEFAULT 'other',
	`color` text DEFAULT '#10b981',
	`icon` text DEFAULT 'target',
	`target_date` text,
	`status` text DEFAULT 'active',
	`priority` integer DEFAULT 0,
	`monthly_contribution` real,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_savings_goals_user` ON `savings_goals` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_goals_household` ON `savings_goals` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_goals_user_household` ON `savings_goals` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_goals_status` ON `savings_goals` (`status`);--> statement-breakpoint
CREATE TABLE `savings_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`percentage` integer NOT NULL,
	`milestone_amount` real NOT NULL,
	`achieved_at` text,
	`notification_sent_at` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_savings_milestones_user` ON `savings_milestones` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_milestones_household` ON `savings_milestones` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_milestones_user_household` ON `savings_milestones` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_milestones_goal` ON `savings_milestones` (`goal_id`);--> statement-breakpoint
CREATE TABLE `search_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filters` text NOT NULL,
	`result_count` integer NOT NULL,
	`execution_time_ms` integer,
	`saved_search_id` text,
	`executed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_search_history_user` ON `search_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_search_history_user_executed` ON `search_history` (`user_id`,`executed_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6366f1',
	`description` text,
	`icon` text,
	`usage_count` integer DEFAULT 0,
	`last_used_at` text,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_tags_user` ON `tags` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tags_user_name` ON `tags` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_tags_user_usage` ON `tags` (`user_id`,`usage_count`);--> statement-breakpoint
CREATE INDEX `idx_tags_user_lastused` ON `tags` (`user_id`,`last_used_at`);--> statement-breakpoint
CREATE TABLE `tax_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`form_type` text NOT NULL,
	`line_number` text,
	`deductible` integer DEFAULT true,
	`category` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_tax_categories_form` ON `tax_categories` (`form_type`);--> statement-breakpoint
CREATE INDEX `idx_tax_categories_category` ON `tax_categories` (`category`);--> statement-breakpoint
CREATE TABLE `transaction_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`user_name` text,
	`action_type` text NOT NULL,
	`changes` text,
	`snapshot` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_transaction_audit_log_transaction` ON `transaction_audit_log` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_audit_log_user` ON `transaction_audit_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_audit_log_household` ON `transaction_audit_log` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_audit_log_created` ON `transaction_audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_transaction_audit_log_tx_created` ON `transaction_audit_log` (`transaction_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `transaction_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`category_id` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`percentage` real,
	`is_percentage` integer DEFAULT false,
	`sort_order` integer DEFAULT 0,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_transaction_splits` ON `transaction_splits` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user` ON `transaction_splits` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_household` ON `transaction_splits` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user_household` ON `transaction_splits` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_category` ON `transaction_splits` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user_tx` ON `transaction_splits` (`user_id`,`transaction_id`);--> statement-breakpoint
CREATE TABLE `transaction_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transaction_tags_unique` ON `transaction_tags` (`transaction_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_user` ON `transaction_tags` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_transaction` ON `transaction_tags` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_tag` ON `transaction_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `transaction_tax_classifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`tax_category_id` text NOT NULL,
	`tax_year` integer NOT NULL,
	`allocated_amount` real NOT NULL,
	`percentage` real,
	`is_deductible` integer DEFAULT true,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_transaction_tax_user` ON `transaction_tax_classifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tax_transaction` ON `transaction_tax_classifications` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tax_category` ON `transaction_tax_classifications` (`tax_category_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tax_year` ON `transaction_tax_classifications` (`tax_year`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tax_user_year` ON `transaction_tax_classifications` (`user_id`,`tax_year`);--> statement-breakpoint
CREATE TABLE `transaction_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`account_id` text NOT NULL,
	`category_id` text,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`notes` text,
	`usage_count` integer DEFAULT 0,
	`last_used_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_transaction_templates_user` ON `transaction_templates` (`user_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`merchant_id` text,
	`bill_id` text,
	`debt_id` text,
	`savings_goal_id` text,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`type` text DEFAULT 'expense',
	`transfer_id` text,
	`is_pending` integer DEFAULT false,
	`is_recurring` integer DEFAULT false,
	`recurring_rule` text,
	`receipt_url` text,
	`is_split` integer DEFAULT false,
	`split_parent_id` text,
	`is_tax_deductible` integer DEFAULT false,
	`tax_deduction_type` text DEFAULT 'none',
	`is_sales_taxable` integer DEFAULT false,
	`is_balance_transfer` integer DEFAULT false,
	`is_refund` integer DEFAULT false,
	`import_history_id` text,
	`import_row_number` integer,
	`sync_status` text DEFAULT 'synced',
	`offline_id` text,
	`synced_at` text,
	`sync_error` text,
	`sync_attempts` integer DEFAULT 0,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_account` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_household` ON `transactions` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_household` ON `transactions` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_household_date` ON `transactions` (`household_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_merchant` ON `transactions` (`merchant_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_type` ON `transactions` (`type`);--> statement-breakpoint
CREATE INDEX `idx_transactions_amount` ON `transactions` (`amount`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_category` ON `transactions` (`user_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_import` ON `transactions` (`import_history_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_sync_status` ON `transactions` (`sync_status`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_sync` ON `transactions` (`user_id`,`sync_status`);--> statement-breakpoint
CREATE INDEX `idx_transactions_offline_id` ON `transactions` (`offline_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_sales_taxable` ON `transactions` (`is_sales_taxable`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_sales_taxable` ON `transactions` (`user_id`,`is_sales_taxable`);--> statement-breakpoint
CREATE INDEX `idx_transactions_savings_goal` ON `transactions` (`savings_goal_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_balance_transfer` ON `transactions` (`is_balance_transfer`);--> statement-breakpoint
CREATE INDEX `idx_transactions_refund` ON `transactions` (`is_refund`);--> statement-breakpoint
CREATE TABLE `transfer_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_transaction_id` text NOT NULL,
	`suggested_transaction_id` text NOT NULL,
	`amount_score` real NOT NULL,
	`date_score` real NOT NULL,
	`description_score` real NOT NULL,
	`account_score` real NOT NULL,
	`total_score` real NOT NULL,
	`confidence` text NOT NULL,
	`status` text DEFAULT 'pending',
	`reviewed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_transfer_suggestions_user` ON `transfer_suggestions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_suggestions_source` ON `transfer_suggestions` (`source_transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_suggestions_status` ON `transfer_suggestions` (`status`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_account_id` text NOT NULL,
	`to_account_id` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`date` text NOT NULL,
	`status` text DEFAULT 'completed',
	`from_transaction_id` text,
	`to_transaction_id` text,
	`fees` real DEFAULT 0,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_transfers_user` ON `transfers` (`user_id`);--> statement-breakpoint
CREATE TABLE `usage_analytics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`item_secondary_id` text,
	`usage_count` integer DEFAULT 1,
	`last_used_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`context_data` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_usage_analytics_unique` ON `usage_analytics` (`user_id`,`household_id`,`item_type`,`item_id`,`item_secondary_id`);--> statement-breakpoint
CREATE INDEX `idx_usage_analytics_user` ON `usage_analytics` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_usage_analytics_household` ON `usage_analytics` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_usage_analytics_user_household` ON `usage_analytics` (`user_id`,`household_id`);--> statement-breakpoint
CREATE TABLE `user_household_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`date_format` text DEFAULT 'MM/DD/YYYY',
	`number_format` text DEFAULT 'en-US',
	`default_account_id` text,
	`first_day_of_week` text DEFAULT 'sunday',
	`show_cents` integer DEFAULT true,
	`negative_number_format` text DEFAULT '-$100',
	`default_transaction_type` text DEFAULT 'expense',
	`combined_transfer_view` integer DEFAULT true,
	`theme` text DEFAULT 'dark-mode',
	`bill_reminders_enabled` integer DEFAULT true,
	`bill_reminders_channels` text DEFAULT '["push","email"]',
	`budget_warnings_enabled` integer DEFAULT true,
	`budget_warnings_channels` text DEFAULT '["push","email"]',
	`budget_exceeded_enabled` integer DEFAULT true,
	`budget_exceeded_channels` text DEFAULT '["push","email"]',
	`budget_review_enabled` integer DEFAULT true,
	`budget_review_channels` text DEFAULT '["push","email"]',
	`low_balance_enabled` integer DEFAULT true,
	`low_balance_channels` text DEFAULT '["push","email"]',
	`savings_milestones_enabled` integer DEFAULT true,
	`savings_milestones_channels` text DEFAULT '["push","email"]',
	`debt_milestones_enabled` integer DEFAULT true,
	`debt_milestones_channels` text DEFAULT '["push","email"]',
	`weekly_summaries_enabled` integer DEFAULT false,
	`weekly_summaries_channels` text DEFAULT '["email"]',
	`monthly_summaries_enabled` integer DEFAULT true,
	`monthly_summaries_channels` text DEFAULT '["email"]',
	`high_utilization_enabled` integer DEFAULT true,
	`high_utilization_threshold` integer DEFAULT 75,
	`high_utilization_channels` text DEFAULT '["push"]',
	`credit_limit_change_enabled` integer DEFAULT true,
	`credit_limit_change_channels` text DEFAULT '["push"]',
	`income_late_enabled` integer DEFAULT true,
	`income_late_channels` text DEFAULT '["push"]',
	`budget_cycle_frequency` text DEFAULT 'monthly',
	`budget_cycle_start_day` integer,
	`budget_cycle_reference_date` text,
	`budget_cycle_semi_monthly_days` text DEFAULT '[1, 15]',
	`budget_period_rollover` integer DEFAULT false,
	`budget_period_manual_amount` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_household_prefs_unique` ON `user_household_preferences` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_user_household_prefs_user` ON `user_household_preferences` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_household_prefs_household` ON `user_household_preferences` (`household_id`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_token` text NOT NULL,
	`device_name` text,
	`device_type` text,
	`browser` text,
	`ip_address` text,
	`user_agent` text,
	`city` text,
	`region` text,
	`country` text,
	`country_code` text,
	`is_current` integer DEFAULT false,
	`last_active_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`expires_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_session_token_unique` ON `user_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_user` ON `user_sessions` (`user_id`,`last_active_at`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`bio` text,
	`timezone` text DEFAULT 'America/New_York',
	`currency` text DEFAULT 'USD',
	`currency_symbol` text DEFAULT '$',
	`date_format` text DEFAULT 'MM/DD/YYYY',
	`number_format` text DEFAULT 'en-US',
	`first_day_of_week` text DEFAULT 'sunday',
	`time_format` text DEFAULT '12h',
	`default_household_id` text,
	`profile_visibility` text DEFAULT 'household',
	`show_activity` integer DEFAULT true,
	`allow_analytics` integer DEFAULT true,
	`reduce_motion` integer DEFAULT false,
	`high_contrast` integer DEFAULT false,
	`text_size` text DEFAULT 'medium',
	`theme` text DEFAULT 'dark-mode',
	`fiscal_year_start` integer DEFAULT 1,
	`default_account_id` text,
	`default_budget_method` text DEFAULT 'monthly',
	`budget_period` text DEFAULT 'monthly',
	`show_cents` integer DEFAULT true,
	`negative_number_format` text DEFAULT '-$100',
	`default_transaction_type` text DEFAULT 'expense',
	`auto_categorization` integer DEFAULT true,
	`session_timeout` integer DEFAULT 30,
	`data_retention_years` integer DEFAULT 7,
	`primary_login_method` text DEFAULT 'email',
	`default_import_template_id` text,
	`developer_mode` integer DEFAULT false,
	`enable_animations` integer DEFAULT true,
	`experimental_features` integer DEFAULT false,
	`onboarding_completed` integer DEFAULT false,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_user_id_unique` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `utilization_alert_state` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`threshold_30_notified` integer DEFAULT false,
	`threshold_50_notified` integer DEFAULT false,
	`threshold_75_notified` integer DEFAULT false,
	`threshold_90_notified` integer DEFAULT false,
	`last_utilization` real,
	`last_checked_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
--> statement-breakpoint
CREATE INDEX `idx_utilization_alert_account` ON `utilization_alert_state` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_utilization_alert_user` ON `utilization_alert_state` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_utilization_alert_household` ON `utilization_alert_state` (`household_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_utilization_alert_unique` ON `utilization_alert_state` (`account_id`,`user_id`);