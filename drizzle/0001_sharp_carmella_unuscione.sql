CREATE TABLE `custom_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`custom_field_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`value` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.929Z'
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
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
CREATE INDEX `idx_custom_fields_user` ON `custom_fields` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_custom_fields_user_name` ON `custom_fields` (`user_id`,`name`);--> statement-breakpoint
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
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
CREATE INDEX `idx_tags_user` ON `tags` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tags_user_name` ON `tags` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `transaction_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transaction_tags_unique` ON `transaction_tags` (`transaction_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_user` ON `transaction_tags` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_transaction` ON `transaction_tags` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_tag` ON `transaction_tags` (`tag_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_account_deletion_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reason` text,
	`scheduled_deletion_date` text NOT NULL,
	`status` text DEFAULT 'pending',
	`requested_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`cancelled_at` text,
	`completed_at` text
);
--> statement-breakpoint
INSERT INTO `__new_account_deletion_requests`("id", "user_id", "reason", "scheduled_deletion_date", "status", "requested_at", "cancelled_at", "completed_at") SELECT "id", "user_id", "reason", "scheduled_deletion_date", "status", "requested_at", "cancelled_at", "completed_at" FROM `account_deletion_requests`;--> statement-breakpoint
DROP TABLE `account_deletion_requests`;--> statement-breakpoint
ALTER TABLE `__new_account_deletion_requests` RENAME TO `account_deletion_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`bank_name` text,
	`account_number_last4` text,
	`current_balance` real DEFAULT 0,
	`available_balance` real,
	`credit_limit` real,
	`is_active` integer DEFAULT true,
	`color` text DEFAULT '#3b82f6',
	`icon` text DEFAULT 'wallet',
	`sort_order` integer DEFAULT 0,
	`usage_count` integer DEFAULT 0,
	`last_used_at` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.927Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.927Z'
);
--> statement-breakpoint
INSERT INTO `__new_accounts`("id", "user_id", "name", "type", "bank_name", "account_number_last4", "current_balance", "available_balance", "credit_limit", "is_active", "color", "icon", "sort_order", "usage_count", "last_used_at", "created_at", "updated_at") SELECT "id", "user_id", "name", "type", "bank_name", "account_number_last4", "current_balance", "available_balance", "credit_limit", "is_active", "color", "icon", "sort_order", "usage_count", "last_used_at", "created_at", "updated_at" FROM `accounts`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;--> statement-breakpoint
CREATE INDEX `idx_accounts_user` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_activity_log`("id", "household_id", "user_id", "action_type", "entity_type", "entity_id", "details", "created_at") SELECT "id", "household_id", "user_id", "action_type", "entity_type", "entity_id", "details", "created_at" FROM `activity_log`;--> statement-breakpoint
DROP TABLE `activity_log`;--> statement-breakpoint
ALTER TABLE `__new_activity_log` RENAME TO `activity_log`;--> statement-breakpoint
CREATE INDEX `idx_household_activity` ON `activity_log` (`household_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_bill_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_bill_instances`("id", "user_id", "bill_id", "due_date", "expected_amount", "actual_amount", "paid_date", "transaction_id", "status", "days_late", "late_fee", "is_manual_override", "notes", "created_at", "updated_at") SELECT "id", "user_id", "bill_id", "due_date", "expected_amount", "actual_amount", "paid_date", "transaction_id", "status", "days_late", "late_fee", "is_manual_override", "notes", "created_at", "updated_at" FROM `bill_instances`;--> statement-breakpoint
DROP TABLE `bill_instances`;--> statement-breakpoint
ALTER TABLE `__new_bill_instances` RENAME TO `bill_instances`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bill_instances_unique` ON `bill_instances` (`bill_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_bill_instances_user` ON `bill_instances` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category_id` text,
	`expected_amount` real NOT NULL,
	`due_date` integer NOT NULL,
	`is_variable_amount` integer DEFAULT false,
	`amount_tolerance` real DEFAULT 5,
	`payee_patterns` text,
	`account_id` text,
	`is_active` integer DEFAULT true,
	`auto_mark_paid` integer DEFAULT true,
	`notes` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_bills`("id", "user_id", "name", "category_id", "expected_amount", "due_date", "is_variable_amount", "amount_tolerance", "payee_patterns", "account_id", "is_active", "auto_mark_paid", "notes", "created_at") SELECT "id", "user_id", "name", "category_id", "expected_amount", "due_date", "is_variable_amount", "amount_tolerance", "payee_patterns", "account_id", "is_active", "auto_mark_paid", "notes", "created_at" FROM `bills`;--> statement-breakpoint
DROP TABLE `bills`;--> statement-breakpoint
ALTER TABLE `__new_bills` RENAME TO `bills`;--> statement-breakpoint
CREATE INDEX `idx_bills_user` ON `bills` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_budget_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`monthly_budget` real DEFAULT 0,
	`due_date` integer,
	`is_active` integer DEFAULT true,
	`sort_order` integer DEFAULT 0,
	`usage_count` integer DEFAULT 0,
	`last_used_at` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_budget_categories`("id", "user_id", "name", "type", "monthly_budget", "due_date", "is_active", "sort_order", "usage_count", "last_used_at", "created_at") SELECT "id", "user_id", "name", "type", "monthly_budget", "due_date", "is_active", "sort_order", "usage_count", "last_used_at", "created_at" FROM `budget_categories`;--> statement-breakpoint
DROP TABLE `budget_categories`;--> statement-breakpoint
ALTER TABLE `__new_budget_categories` RENAME TO `budget_categories`;--> statement-breakpoint
CREATE INDEX `idx_budget_categories_user` ON `budget_categories` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_budget_periods` (
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
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_budget_periods`("id", "user_id", "month", "year", "total_income", "total_variable_expenses", "total_monthly_bills", "total_savings", "total_debt_payments", "is_active", "created_at") SELECT "id", "user_id", "month", "year", "total_income", "total_variable_expenses", "total_monthly_bills", "total_savings", "total_debt_payments", "is_active", "created_at" FROM `budget_periods`;--> statement-breakpoint
DROP TABLE `budget_periods`;--> statement-breakpoint
ALTER TABLE `__new_budget_periods` RENAME TO `budget_periods`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_budget_periods_unique` ON `budget_periods` (`user_id`,`month`,`year`);--> statement-breakpoint
CREATE TABLE `__new_categorization_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category_id` text NOT NULL,
	`description` text,
	`priority` integer DEFAULT 100,
	`is_active` integer DEFAULT true,
	`conditions` text NOT NULL,
	`match_count` integer DEFAULT 0,
	`last_matched_at` text,
	`test_results` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
INSERT INTO `__new_categorization_rules`("id", "user_id", "name", "category_id", "description", "priority", "is_active", "conditions", "match_count", "last_matched_at", "test_results", "created_at", "updated_at") SELECT "id", "user_id", "name", "category_id", "description", "priority", "is_active", "conditions", "match_count", "last_matched_at", "test_results", "created_at", "updated_at" FROM `categorization_rules`;--> statement-breakpoint
DROP TABLE `categorization_rules`;--> statement-breakpoint
ALTER TABLE `__new_categorization_rules` RENAME TO `categorization_rules`;--> statement-breakpoint
CREATE INDEX `idx_categorization_rules_user` ON `categorization_rules` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_categorization_rules_priority` ON `categorization_rules` (`priority`);--> statement-breakpoint
CREATE TABLE `__new_data_export_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending',
	`export_format` text DEFAULT 'json',
	`file_url` text,
	`file_size` integer,
	`expires_at` text,
	`requested_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`completed_at` text
);
--> statement-breakpoint
INSERT INTO `__new_data_export_requests`("id", "user_id", "status", "export_format", "file_url", "file_size", "expires_at", "requested_at", "completed_at") SELECT "id", "user_id", "status", "export_format", "file_url", "file_size", "expires_at", "requested_at", "completed_at" FROM `data_export_requests`;--> statement-breakpoint
DROP TABLE `data_export_requests`;--> statement-breakpoint
ALTER TABLE `__new_data_export_requests` RENAME TO `data_export_requests`;--> statement-breakpoint
CREATE TABLE `__new_debt_payoff_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`milestone_type` text NOT NULL,
	`achieved_date` text NOT NULL,
	`total_paid_off` real NOT NULL,
	`remaining_debt` real NOT NULL,
	`months_since_start` integer,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_debt_payoff_milestones`("id", "user_id", "milestone_type", "achieved_date", "total_paid_off", "remaining_debt", "months_since_start", "created_at") SELECT "id", "user_id", "milestone_type", "achieved_date", "total_paid_off", "remaining_debt", "months_since_start", "created_at" FROM `debt_payoff_milestones`;--> statement-breakpoint
DROP TABLE `debt_payoff_milestones`;--> statement-breakpoint
ALTER TABLE `__new_debt_payoff_milestones` RENAME TO `debt_payoff_milestones`;--> statement-breakpoint
CREATE INDEX `idx_milestones_user` ON `debt_payoff_milestones` (`user_id`,`achieved_date`);--> statement-breakpoint
CREATE TABLE `__new_debt_payoff_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`strategy` text DEFAULT 'snowball',
	`total_extra_payment` real DEFAULT 0,
	`auto_allocate_extra` integer DEFAULT true,
	`show_comparison` integer DEFAULT true,
	`payoff_start_date` text,
	`starting_total_debt` real DEFAULT 0,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_debt_payoff_settings`("id", "user_id", "strategy", "total_extra_payment", "auto_allocate_extra", "show_comparison", "payoff_start_date", "starting_total_debt", "created_at", "updated_at") SELECT "id", "user_id", "strategy", "total_extra_payment", "auto_allocate_extra", "show_comparison", "payoff_start_date", "starting_total_debt", "created_at", "updated_at" FROM `debt_payoff_settings`;--> statement-breakpoint
DROP TABLE `debt_payoff_settings`;--> statement-breakpoint
ALTER TABLE `__new_debt_payoff_settings` RENAME TO `debt_payoff_settings`;--> statement-breakpoint
CREATE UNIQUE INDEX `debt_payoff_settings_user_id_unique` ON `debt_payoff_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_debts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`current_balance` real NOT NULL,
	`minimum_payment` real NOT NULL,
	`interest_rate` real,
	`due_date` integer,
	`additional_payment` real DEFAULT 0,
	`account_id` text,
	`is_active` integer DEFAULT true,
	`priority_order` integer DEFAULT 0,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_debts`("id", "user_id", "name", "current_balance", "minimum_payment", "interest_rate", "due_date", "additional_payment", "account_id", "is_active", "priority_order", "created_at") SELECT "id", "user_id", "name", "current_balance", "minimum_payment", "interest_rate", "due_date", "additional_payment", "account_id", "is_active", "priority_order", "created_at" FROM `debts`;--> statement-breakpoint
DROP TABLE `debts`;--> statement-breakpoint
ALTER TABLE `__new_debts` RENAME TO `debts`;--> statement-breakpoint
CREATE INDEX `idx_debts_user` ON `debts` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_household_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`invited_email` text NOT NULL,
	`invited_by` text NOT NULL,
	`role` text DEFAULT 'member',
	`invitation_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`status` text DEFAULT 'pending',
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_household_invitations`("id", "household_id", "invited_email", "invited_by", "role", "invitation_token", "expires_at", "accepted_at", "status", "created_at") SELECT "id", "household_id", "invited_email", "invited_by", "role", "invitation_token", "expires_at", "accepted_at", "status", "created_at" FROM `household_invitations`;--> statement-breakpoint
DROP TABLE `household_invitations`;--> statement-breakpoint
ALTER TABLE `__new_household_invitations` RENAME TO `household_invitations`;--> statement-breakpoint
CREATE UNIQUE INDEX `household_invitations_invitation_token_unique` ON `household_invitations` (`invitation_token`);--> statement-breakpoint
CREATE INDEX `idx_household_invitations` ON `household_invitations` (`household_id`);--> statement-breakpoint
CREATE TABLE `__new_household_members` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text,
	`role` text DEFAULT 'member',
	`joined_at` text DEFAULT '2025-11-08T03:59:51.928Z',
	`invited_by` text,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
INSERT INTO `__new_household_members`("id", "household_id", "user_id", "user_email", "user_name", "role", "joined_at", "invited_by", "is_active") SELECT "id", "household_id", "user_id", "user_email", "user_name", "role", "joined_at", "invited_by", "is_active" FROM `household_members`;--> statement-breakpoint
DROP TABLE `household_members`;--> statement-breakpoint
ALTER TABLE `__new_household_members` RENAME TO `household_members`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_household_members_unique` ON `household_members` (`household_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `__new_households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_households`("id", "name", "created_by", "created_at", "updated_at") SELECT "id", "name", "created_by", "created_at", "updated_at" FROM `households`;--> statement-breakpoint
DROP TABLE `households`;--> statement-breakpoint
ALTER TABLE `__new_households` RENAME TO `households`;--> statement-breakpoint
CREATE TABLE `__new_import_history` (
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
	`started_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`completed_at` text,
	`rolled_back_at` text
);
--> statement-breakpoint
INSERT INTO `__new_import_history`("id", "user_id", "household_id", "template_id", "filename", "file_size", "rows_total", "rows_imported", "rows_skipped", "rows_duplicates", "status", "error_message", "import_settings", "started_at", "completed_at", "rolled_back_at") SELECT "id", "user_id", "household_id", "template_id", "filename", "file_size", "rows_total", "rows_imported", "rows_skipped", "rows_duplicates", "status", "error_message", "import_settings", "started_at", "completed_at", "rolled_back_at" FROM `import_history`;--> statement-breakpoint
DROP TABLE `import_history`;--> statement-breakpoint
ALTER TABLE `__new_import_history` RENAME TO `import_history`;--> statement-breakpoint
CREATE INDEX `idx_import_history_user` ON `import_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_import_history_user_created` ON `import_history` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `__new_import_staging` (
	`id` text PRIMARY KEY NOT NULL,
	`import_history_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw_data` text NOT NULL,
	`mapped_data` text NOT NULL,
	`duplicate_of` text,
	`duplicate_score` real,
	`status` text NOT NULL,
	`validation_errors` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
INSERT INTO `__new_import_staging`("id", "import_history_id", "row_number", "raw_data", "mapped_data", "duplicate_of", "duplicate_score", "status", "validation_errors", "created_at") SELECT "id", "import_history_id", "row_number", "raw_data", "mapped_data", "duplicate_of", "duplicate_score", "status", "validation_errors", "created_at" FROM `import_staging`;--> statement-breakpoint
DROP TABLE `import_staging`;--> statement-breakpoint
ALTER TABLE `__new_import_staging` RENAME TO `import_staging`;--> statement-breakpoint
CREATE INDEX `idx_import_staging_history` ON `import_staging` (`import_history_id`);--> statement-breakpoint
CREATE TABLE `__new_import_templates` (
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
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
INSERT INTO `__new_import_templates`("id", "user_id", "household_id", "name", "description", "column_mappings", "date_format", "delimiter", "has_header_row", "skip_rows", "default_account_id", "is_favorite", "usage_count", "last_used_at", "created_at", "updated_at") SELECT "id", "user_id", "household_id", "name", "description", "column_mappings", "date_format", "delimiter", "has_header_row", "skip_rows", "default_account_id", "is_favorite", "usage_count", "last_used_at", "created_at", "updated_at" FROM `import_templates`;--> statement-breakpoint
DROP TABLE `import_templates`;--> statement-breakpoint
ALTER TABLE `__new_import_templates` RENAME TO `import_templates`;--> statement-breakpoint
CREATE INDEX `idx_import_templates_user` ON `import_templates` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_import_templates_user_household` ON `import_templates` (`user_id`,`household_id`);--> statement-breakpoint
CREATE TABLE `__new_merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`category_id` text,
	`usage_count` integer DEFAULT 1,
	`last_used_at` text DEFAULT '2025-11-08T03:59:51.928Z',
	`total_spent` real DEFAULT 0,
	`average_transaction` real DEFAULT 0,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_merchants`("id", "user_id", "name", "normalized_name", "category_id", "usage_count", "last_used_at", "total_spent", "average_transaction", "created_at", "updated_at") SELECT "id", "user_id", "name", "normalized_name", "category_id", "usage_count", "last_used_at", "total_spent", "average_transaction", "created_at", "updated_at" FROM `merchants`;--> statement-breakpoint
DROP TABLE `merchants`;--> statement-breakpoint
ALTER TABLE `__new_merchants` RENAME TO `merchants`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_merchants_user_normalized` ON `merchants` (`user_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `idx_merchants_user` ON `merchants` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_non_monthly_bills` (
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
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_non_monthly_bills`("id", "user_id", "name", "january_due", "january_amount", "february_due", "february_amount", "march_due", "march_amount", "april_due", "april_amount", "may_due", "may_amount", "june_due", "june_amount", "july_due", "july_amount", "august_due", "august_amount", "september_due", "september_amount", "october_due", "october_amount", "november_due", "november_amount", "december_due", "december_amount", "created_at") SELECT "id", "user_id", "name", "january_due", "january_amount", "february_due", "february_amount", "march_due", "march_amount", "april_due", "april_amount", "may_due", "may_amount", "june_due", "june_amount", "july_due", "july_amount", "august_due", "august_amount", "september_due", "september_amount", "october_due", "october_amount", "november_due", "november_amount", "december_due", "december_amount", "created_at" FROM `non_monthly_bills`;--> statement-breakpoint
DROP TABLE `non_monthly_bills`;--> statement-breakpoint
ALTER TABLE `__new_non_monthly_bills` RENAME TO `non_monthly_bills`;--> statement-breakpoint
CREATE INDEX `idx_non_monthly_bills_user` ON `non_monthly_bills` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text,
	`bill_reminder_enabled` integer DEFAULT true,
	`bill_reminder_days_before` integer DEFAULT 3,
	`bill_reminder_on_due_date` integer DEFAULT true,
	`bill_overdue_reminder` integer DEFAULT true,
	`budget_warning_enabled` integer DEFAULT true,
	`budget_warning_threshold` integer DEFAULT 80,
	`budget_exceeded_alert` integer DEFAULT true,
	`low_balance_alert_enabled` integer DEFAULT true,
	`low_balance_threshold` real DEFAULT 100,
	`savings_milestone_enabled` integer DEFAULT true,
	`debt_milestone_enabled` integer DEFAULT true,
	`weekly_summary_enabled` integer DEFAULT true,
	`weekly_summary_day` text DEFAULT 'sunday',
	`monthly_summary_enabled` integer DEFAULT true,
	`monthly_summary_day` integer DEFAULT 1,
	`push_notifications_enabled` integer DEFAULT true,
	`email_notifications_enabled` integer DEFAULT false,
	`email_address` text,
	`quiet_hours_start` text,
	`quiet_hours_end` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_notification_preferences`("id", "user_id", "household_id", "bill_reminder_enabled", "bill_reminder_days_before", "bill_reminder_on_due_date", "bill_overdue_reminder", "budget_warning_enabled", "budget_warning_threshold", "budget_exceeded_alert", "low_balance_alert_enabled", "low_balance_threshold", "savings_milestone_enabled", "debt_milestone_enabled", "weekly_summary_enabled", "weekly_summary_day", "monthly_summary_enabled", "monthly_summary_day", "push_notifications_enabled", "email_notifications_enabled", "email_address", "quiet_hours_start", "quiet_hours_end", "created_at", "updated_at") SELECT "id", "user_id", "household_id", "bill_reminder_enabled", "bill_reminder_days_before", "bill_reminder_on_due_date", "bill_overdue_reminder", "budget_warning_enabled", "budget_warning_threshold", "budget_exceeded_alert", "low_balance_alert_enabled", "low_balance_threshold", "savings_milestone_enabled", "debt_milestone_enabled", "weekly_summary_enabled", "weekly_summary_day", "monthly_summary_enabled", "monthly_summary_day", "push_notifications_enabled", "email_notifications_enabled", "email_address", "quiet_hours_start", "quiet_hours_end", "created_at", "updated_at" FROM `notification_preferences`;--> statement-breakpoint
DROP TABLE `notification_preferences`;--> statement-breakpoint
ALTER TABLE `__new_notification_preferences` RENAME TO `notification_preferences`;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_user_id_unique` ON `notification_preferences` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_notifications` (
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
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_notifications`("id", "user_id", "household_id", "type", "priority", "title", "message", "action_url", "entity_type", "entity_id", "is_read", "is_dismissed", "is_actionable", "action_label", "scheduled_for", "sent_at", "read_at", "dismissed_at", "expires_at", "metadata", "created_at") SELECT "id", "user_id", "household_id", "type", "priority", "title", "message", "action_url", "entity_type", "entity_id", "is_read", "is_dismissed", "is_actionable", "action_label", "scheduled_for", "sent_at", "read_at", "dismissed_at", "expires_at", "metadata", "created_at" FROM `notifications`;--> statement-breakpoint
DROP TABLE `notifications`;--> statement-breakpoint
ALTER TABLE `__new_notifications` RENAME TO `notifications`;--> statement-breakpoint
CREATE INDEX `idx_user_notifications` ON `notifications` (`user_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_notifications` ON `notifications` (`scheduled_for`,`sent_at`);--> statement-breakpoint
CREATE TABLE `__new_push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh_key` text NOT NULL,
	`auth_key` text NOT NULL,
	`user_agent` text,
	`device_name` text,
	`is_active` integer DEFAULT true,
	`last_used_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
INSERT INTO `__new_push_subscriptions`("id", "user_id", "endpoint", "p256dh_key", "auth_key", "user_agent", "device_name", "is_active", "last_used_at", "created_at") SELECT "id", "user_id", "endpoint", "p256dh_key", "auth_key", "user_agent", "device_name", "is_active", "last_used_at", "created_at" FROM `push_subscriptions`;--> statement-breakpoint
DROP TABLE `push_subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_push_subscriptions` RENAME TO `push_subscriptions`;--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_resource_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`visibility` text DEFAULT 'shared',
	`can_view` text DEFAULT 'all',
	`can_edit` text DEFAULT 'all',
	`allowed_user_ids` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_resource_permissions`("id", "household_id", "resource_type", "resource_id", "visibility", "can_view", "can_edit", "allowed_user_ids", "created_by", "created_at") SELECT "id", "household_id", "resource_type", "resource_id", "visibility", "can_view", "can_edit", "allowed_user_ids", "created_by", "created_at" FROM `resource_permissions`;--> statement-breakpoint
DROP TABLE `resource_permissions`;--> statement-breakpoint
ALTER TABLE `__new_resource_permissions` RENAME TO `resource_permissions`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_resource_permissions_unique` ON `resource_permissions` (`household_id`,`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `__new_rule_execution_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`applied_category_id` text NOT NULL,
	`matched` integer NOT NULL,
	`executed_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
INSERT INTO `__new_rule_execution_log`("id", "user_id", "rule_id", "transaction_id", "applied_category_id", "matched", "executed_at") SELECT "id", "user_id", "rule_id", "transaction_id", "applied_category_id", "matched", "executed_at" FROM `rule_execution_log`;--> statement-breakpoint
DROP TABLE `rule_execution_log`;--> statement-breakpoint
ALTER TABLE `__new_rule_execution_log` RENAME TO `rule_execution_log`;--> statement-breakpoint
CREATE INDEX `idx_rule_execution_user` ON `rule_execution_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_rule_execution_rule` ON `rule_execution_log` (`rule_id`);--> statement-breakpoint
CREATE INDEX `idx_rule_execution_transaction` ON `rule_execution_log` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `__new_saved_search_filters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`filters` text NOT NULL,
	`is_default` integer DEFAULT false,
	`usage_count` integer DEFAULT 0,
	`last_used_at` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
INSERT INTO `__new_saved_search_filters`("id", "user_id", "name", "description", "filters", "is_default", "usage_count", "last_used_at", "created_at", "updated_at") SELECT "id", "user_id", "name", "description", "filters", "is_default", "usage_count", "last_used_at", "created_at", "updated_at" FROM `saved_search_filters`;--> statement-breakpoint
DROP TABLE `saved_search_filters`;--> statement-breakpoint
ALTER TABLE `__new_saved_search_filters` RENAME TO `saved_search_filters`;--> statement-breakpoint
CREATE INDEX `idx_saved_search_filters_user` ON `saved_search_filters` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_saved_search_filters_user_default` ON `saved_search_filters` (`user_id`,`is_default`);--> statement-breakpoint
CREATE TABLE `__new_savings_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`target_amount` real NOT NULL,
	`starting_amount` real DEFAULT 0,
	`current_amount` real DEFAULT 0,
	`start_date` text NOT NULL,
	`target_date` text,
	`monthly_contribution` real DEFAULT 0,
	`account_id` text,
	`is_completed` integer DEFAULT false,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_savings_goals`("id", "user_id", "name", "target_amount", "starting_amount", "current_amount", "start_date", "target_date", "monthly_contribution", "account_id", "is_completed", "created_at") SELECT "id", "user_id", "name", "target_amount", "starting_amount", "current_amount", "start_date", "target_date", "monthly_contribution", "account_id", "is_completed", "created_at" FROM `savings_goals`;--> statement-breakpoint
DROP TABLE `savings_goals`;--> statement-breakpoint
ALTER TABLE `__new_savings_goals` RENAME TO `savings_goals`;--> statement-breakpoint
CREATE INDEX `idx_savings_goals_user` ON `savings_goals` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_search_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filters` text NOT NULL,
	`result_count` integer NOT NULL,
	`execution_time_ms` integer,
	`saved_search_id` text,
	`executed_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
INSERT INTO `__new_search_history`("id", "user_id", "filters", "result_count", "execution_time_ms", "saved_search_id", "executed_at") SELECT "id", "user_id", "filters", "result_count", "execution_time_ms", "saved_search_id", "executed_at" FROM `search_history`;--> statement-breakpoint
DROP TABLE `search_history`;--> statement-breakpoint
ALTER TABLE `__new_search_history` RENAME TO `search_history`;--> statement-breakpoint
CREATE INDEX `idx_search_history_user` ON `search_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_search_history_user_executed` ON `search_history` (`user_id`,`executed_at`);--> statement-breakpoint
CREATE TABLE `__new_transaction_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`category_id` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`percentage` real,
	`is_percentage` integer DEFAULT false,
	`sort_order` integer DEFAULT 0,
	`notes` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_transaction_splits`("id", "user_id", "transaction_id", "category_id", "amount", "description", "percentage", "is_percentage", "sort_order", "notes", "created_at", "updated_at") SELECT "id", "user_id", "transaction_id", "category_id", "amount", "description", "percentage", "is_percentage", "sort_order", "notes", "created_at", "updated_at" FROM `transaction_splits`;--> statement-breakpoint
DROP TABLE `transaction_splits`;--> statement-breakpoint
ALTER TABLE `__new_transaction_splits` RENAME TO `transaction_splits`;--> statement-breakpoint
CREATE INDEX `idx_transaction_splits` ON `transaction_splits` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user` ON `transaction_splits` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_category` ON `transaction_splits` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user_tx` ON `transaction_splits` (`user_id`,`transaction_id`);--> statement-breakpoint
CREATE TABLE `__new_transaction_templates` (
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
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
INSERT INTO `__new_transaction_templates`("id", "user_id", "name", "description", "account_id", "category_id", "amount", "type", "notes", "usage_count", "last_used_at", "created_at", "updated_at") SELECT "id", "user_id", "name", "description", "account_id", "category_id", "amount", "type", "notes", "usage_count", "last_used_at", "created_at", "updated_at" FROM `transaction_templates`;--> statement-breakpoint
DROP TABLE `transaction_templates`;--> statement-breakpoint
ALTER TABLE `__new_transaction_templates` RENAME TO `transaction_templates`;--> statement-breakpoint
CREATE INDEX `idx_transaction_templates_user` ON `transaction_templates` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`bill_id` text,
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
	`import_history_id` text,
	`import_row_number` integer,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "user_id", "account_id", "category_id", "bill_id", "date", "amount", "description", "notes", "type", "transfer_id", "is_pending", "is_recurring", "recurring_rule", "receipt_url", "is_split", "split_parent_id", "import_history_id", "import_row_number", "created_at", "updated_at") SELECT "id", "user_id", "account_id", "category_id", "bill_id", "date", "amount", "description", "notes", "type", "transfer_id", "is_pending", "is_recurring", "recurring_rule", "receipt_url", "is_split", "split_parent_id", "import_history_id", "import_row_number", "created_at", "updated_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `idx_transactions_account` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_type` ON `transactions` (`type`);--> statement-breakpoint
CREATE INDEX `idx_transactions_amount` ON `transactions` (`amount`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_category` ON `transactions` (`user_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_import` ON `transactions` (`import_history_id`);--> statement-breakpoint
CREATE TABLE `__new_transfers` (
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
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_transfers`("id", "user_id", "from_account_id", "to_account_id", "amount", "description", "date", "status", "from_transaction_id", "to_transaction_id", "fees", "notes", "created_at") SELECT "id", "user_id", "from_account_id", "to_account_id", "amount", "description", "date", "status", "from_transaction_id", "to_transaction_id", "fees", "notes", "created_at" FROM `transfers`;--> statement-breakpoint
DROP TABLE `transfers`;--> statement-breakpoint
ALTER TABLE `__new_transfers` RENAME TO `transfers`;--> statement-breakpoint
CREATE INDEX `idx_transfers_user` ON `transfers` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_usage_analytics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`item_secondary_id` text,
	`usage_count` integer DEFAULT 1,
	`last_used_at` text DEFAULT '2025-11-08T03:59:51.928Z',
	`context_data` text,
	`created_at` text DEFAULT '2025-11-08T03:59:51.928Z'
);
--> statement-breakpoint
INSERT INTO `__new_usage_analytics`("id", "user_id", "item_type", "item_id", "item_secondary_id", "usage_count", "last_used_at", "context_data", "created_at") SELECT "id", "user_id", "item_type", "item_id", "item_secondary_id", "usage_count", "last_used_at", "context_data", "created_at" FROM `usage_analytics`;--> statement-breakpoint
DROP TABLE `usage_analytics`;--> statement-breakpoint
ALTER TABLE `__new_usage_analytics` RENAME TO `usage_analytics`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_usage_analytics_unique` ON `usage_analytics` (`user_id`,`item_type`,`item_id`,`item_secondary_id`);--> statement-breakpoint
CREATE INDEX `idx_usage_analytics_user` ON `usage_analytics` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_token` text NOT NULL,
	`device_name` text,
	`device_type` text,
	`browser` text,
	`ip_address` text,
	`user_agent` text,
	`is_current` integer DEFAULT false,
	`last_active_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`expires_at` text
);
--> statement-breakpoint
INSERT INTO `__new_user_sessions`("id", "user_id", "session_token", "device_name", "device_type", "browser", "ip_address", "user_agent", "is_current", "last_active_at", "created_at", "expires_at") SELECT "id", "user_id", "session_token", "device_name", "device_type", "browser", "ip_address", "user_agent", "is_current", "last_active_at", "created_at", "expires_at" FROM `user_sessions`;--> statement-breakpoint
DROP TABLE `user_sessions`;--> statement-breakpoint
ALTER TABLE `__new_user_sessions` RENAME TO `user_sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_session_token_unique` ON `user_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_user` ON `user_sessions` (`user_id`,`last_active_at`);--> statement-breakpoint
CREATE TABLE `__new_user_settings` (
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
	`created_at` text DEFAULT '2025-11-08T03:59:51.929Z',
	`updated_at` text DEFAULT '2025-11-08T03:59:51.929Z'
);
--> statement-breakpoint
INSERT INTO `__new_user_settings`("id", "user_id", "display_name", "avatar_url", "bio", "timezone", "currency", "currency_symbol", "date_format", "number_format", "first_day_of_week", "time_format", "default_household_id", "profile_visibility", "show_activity", "allow_analytics", "reduce_motion", "high_contrast", "text_size", "created_at", "updated_at") SELECT "id", "user_id", "display_name", "avatar_url", "bio", "timezone", "currency", "currency_symbol", "date_format", "number_format", "first_day_of_week", "time_format", "default_household_id", "profile_visibility", "show_activity", "allow_analytics", "reduce_motion", "high_contrast", "text_size", "created_at", "updated_at" FROM `user_settings`;--> statement-breakpoint
DROP TABLE `user_settings`;--> statement-breakpoint
ALTER TABLE `__new_user_settings` RENAME TO `user_settings`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_user_id_unique` ON `user_settings` (`user_id`);