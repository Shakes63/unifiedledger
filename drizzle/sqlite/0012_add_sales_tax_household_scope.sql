DROP TABLE IF EXISTS `sales_tax_transactions`;--> statement-breakpoint
DROP TABLE IF EXISTS `sales_tax_categories`;--> statement-breakpoint
DROP TABLE IF EXISTS `sales_tax_settings`;--> statement-breakpoint
DROP TABLE IF EXISTS `quarterly_filing_records`;--> statement-breakpoint
CREATE TABLE `sales_tax_settings` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `household_id` text NOT NULL, `default_rate` real DEFAULT 0 NOT NULL, `jurisdiction` text, `fiscal_year_start` text, `filing_frequency` text DEFAULT 'quarterly', `enable_tracking` integer DEFAULT true, `state_rate` real DEFAULT 0, `county_rate` real DEFAULT 0, `city_rate` real DEFAULT 0, `special_district_rate` real DEFAULT 0, `state_name` text, `county_name` text, `city_name` text, `special_district_name` text, `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));--> statement-breakpoint
CREATE INDEX `idx_sales_tax_settings_user` ON `sales_tax_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_settings_household` ON `sales_tax_settings` (`household_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sales_tax_settings_user_household_unique` ON `sales_tax_settings` (`user_id`,`household_id`);--> statement-breakpoint
CREATE TABLE `sales_tax_categories` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `household_id` text NOT NULL, `name` text NOT NULL, `rate` real NOT NULL, `description` text, `is_default` integer DEFAULT false, `is_active` integer DEFAULT true, `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));--> statement-breakpoint
CREATE INDEX `idx_sales_tax_categories_user` ON `sales_tax_categories` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_categories_household` ON `sales_tax_categories` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_categories_user_active` ON `sales_tax_categories` (`user_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_categories_household_active` ON `sales_tax_categories` (`household_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `sales_tax_transactions` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `household_id` text NOT NULL, `account_id` text NOT NULL, `transaction_id` text NOT NULL, `transaction_date` text NOT NULL, `taxable_amount_cents` integer NOT NULL, `tax_amount_cents` integer NOT NULL, `applied_rate_bps` integer NOT NULL, `jurisdiction_snapshot` text, `tax_year` integer NOT NULL, `quarter` integer NOT NULL, `reported_status` text DEFAULT 'pending', `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_user` ON `sales_tax_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_household` ON `sales_tax_transactions` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_account` ON `sales_tax_transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_transaction` ON `sales_tax_transactions` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_transaction_date` ON `sales_tax_transactions` (`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_quarter` ON `sales_tax_transactions` (`quarter`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_status` ON `sales_tax_transactions` (`reported_status`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_user_quarter` ON `sales_tax_transactions` (`user_id`,`tax_year`,`quarter`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_household_quarter` ON `sales_tax_transactions` (`household_id`,`tax_year`,`quarter`);--> statement-breakpoint
CREATE INDEX `idx_sales_tax_transactions_user_account_quarter` ON `sales_tax_transactions` (`user_id`,`account_id`,`tax_year`,`quarter`);--> statement-breakpoint
CREATE TABLE `quarterly_filing_records` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `household_id` text NOT NULL, `tax_year` integer NOT NULL, `quarter` integer NOT NULL, `due_date` text NOT NULL, `submitted_date` text, `status` text DEFAULT 'pending', `total_sales_amount` real DEFAULT 0, `total_tax_amount` real DEFAULT 0, `amount_paid` real DEFAULT 0, `balance_due` real DEFAULT 0, `notes` text, `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));--> statement-breakpoint
CREATE INDEX `idx_quarterly_filing_user` ON `quarterly_filing_records` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_quarterly_filing_household` ON `quarterly_filing_records` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_quarterly_filing_user_year` ON `quarterly_filing_records` (`user_id`,`tax_year`);--> statement-breakpoint
CREATE INDEX `idx_quarterly_filing_household_year` ON `quarterly_filing_records` (`household_id`,`tax_year`);--> statement-breakpoint
CREATE INDEX `idx_quarterly_filing_status` ON `quarterly_filing_records` (`status`);--> statement-breakpoint
CREATE INDEX `idx_quarterly_filing_due_date` ON `quarterly_filing_records` (`due_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quarterly_filing_user_household_year_quarter_unique` ON `quarterly_filing_records` (`user_id`,`household_id`,`tax_year`,`quarter`);
