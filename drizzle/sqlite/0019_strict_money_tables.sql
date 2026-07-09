-- STRICT money tables: convert the 12 money-holding tables to SQLite STRICT so
-- the type flexibility that enabled the original float/text corruption class is
-- rejected by the database itself (e.g. a fractional 3332.999... can no longer
-- be stored into an INTEGER cents column — the write errors instead).
--
-- SQLite cannot ALTER a table to STRICT, so each table is rebuilt. Five of them
-- are FK PARENTS (accounts, transactions, debts, savings_goals,
-- bill_occurrences), and dropping a parent under foreign_keys=ON fires the
-- implicit DELETE's CASCADE into its children — so the order below is the only
-- safe one, verified under FK enforcement both ON and OFF:
--   1. create ALL __strict_* tables; children declare FKs against the
--      __strict_ PARENT names so they never bind to the old parents
--   2. copy parents first, then children (explicit column lists)
--   3. drop old CHILD tables (no dependents -> no cascade)
--   4. drop old PARENT tables (nothing references them anymore)
--   5. rename __strict_ parents to final names — SQLite >=3.25 RENAME fixes up
--      the FK references inside the __strict_ children automatically
--   6. rename children; recreate every index and all 16 money-cents triggers
--
-- Column lists reproduce the live schema exactly (including appended columns).
-- ============================ create: parents ============================
CREATE TABLE `__strict_accounts` (
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
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`include_in_discretionary` integer DEFAULT 1,
	`current_balance_cents` integer,
	`available_balance_cents` integer,
	`credit_limit_cents` integer,
	`entity_id` text
) STRICT;--> statement-breakpoint
CREATE TABLE `__strict_transactions` (
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
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`transfer_source_account_id` text,
	`transfer_destination_account_id` text,
	`amount_cents` integer,
	`transfer_group_id` text,
	`paired_transaction_id` text,
	`entity_id` text
) STRICT;--> statement-breakpoint
CREATE TABLE `__strict_debts` (
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
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`remaining_balance_cents` integer
) STRICT;--> statement-breakpoint
CREATE TABLE `__strict_savings_goals` (
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
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`current_amount_cents` integer,
	`target_amount_cents` integer
) STRICT;--> statement-breakpoint
CREATE TABLE `__strict_bill_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`household_id` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text NOT NULL DEFAULT 'unpaid',
	`amount_due_cents` integer NOT NULL,
	`amount_paid_cents` integer NOT NULL DEFAULT 0,
	`amount_remaining_cents` integer NOT NULL,
	`actual_amount_cents` integer,
	`paid_date` text,
	`last_transaction_id` text,
	`days_late` integer NOT NULL DEFAULT 0,
	`late_fee_cents` integer NOT NULL DEFAULT 0,
	`is_manual_override` integer NOT NULL DEFAULT false,
	`budget_period_override` integer,
	`notes` text,
	`created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;--> statement-breakpoint
-- ============================ create: children ============================
CREATE TABLE `__strict_transaction_splits` (
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
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`amount_cents` integer,
	FOREIGN KEY (`transaction_id`) REFERENCES `__strict_transactions`(`id`) ON DELETE CASCADE
) STRICT;--> statement-breakpoint
CREATE TABLE `__strict_transaction_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (`transaction_id`) REFERENCES `__strict_transactions`(`id`) ON DELETE CASCADE
) STRICT;--> statement-breakpoint
CREATE TABLE `__strict_custom_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`custom_field_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`value` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (`transaction_id`) REFERENCES `__strict_transactions`(`id`) ON DELETE CASCADE
) STRICT;--> statement-breakpoint
CREATE TABLE `__strict_debt_payments` (
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
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`amount_cents` integer,
	`principal_cents` integer,
	`interest_cents` integer,
	FOREIGN KEY (`debt_id`) REFERENCES `__strict_debts`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`transaction_id`) REFERENCES `__strict_transactions`(`id`) ON DELETE SET NULL
) STRICT;--> statement-breakpoint
CREATE TABLE `__strict_savings_goal_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`amount_cents` integer,
	FOREIGN KEY (`goal_id`) REFERENCES `__strict_savings_goals`(`id`) ON DELETE CASCADE
) STRICT;--> statement-breakpoint
CREATE TABLE `__strict_bill_payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`template_id` text NOT NULL,
	`occurrence_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`principal_cents` integer,
	`interest_cents` integer,
	`balance_before_cents` integer,
	`balance_after_cents` integer,
	`payment_date` text NOT NULL,
	`payment_method` text NOT NULL DEFAULT 'manual',
	`source_account_id` text,
	`idempotency_key` text,
	`notes` text,
	`created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`occurrence_id`) REFERENCES `__strict_bill_occurrences`(`id`) ON DELETE CASCADE
) STRICT;--> statement-breakpoint
CREATE TABLE `__strict_transfers` (
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
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`household_id` text,
	`amount_cents` integer,
	`fees_cents` integer,
	FOREIGN KEY (`from_transaction_id`) REFERENCES `__strict_transactions`(`id`) ON DELETE SET NULL,
	FOREIGN KEY (`to_transaction_id`) REFERENCES `__strict_transactions`(`id`) ON DELETE SET NULL
) STRICT;--> statement-breakpoint
-- ==================== copy: parents first, then children ====================
INSERT INTO `__strict_accounts` (`id`,`user_id`,`household_id`,`name`,`type`,`bank_name`,`account_number_last4`,`current_balance`,`available_balance`,`credit_limit`,`is_active`,`is_business_account`,`enable_sales_tax`,`enable_tax_deductions`,`color`,`icon`,`sort_order`,`usage_count`,`last_used_at`,`statement_balance`,`statement_date`,`statement_due_date`,`minimum_payment_amount`,`last_statement_updated`,`interest_rate`,`minimum_payment_percent`,`minimum_payment_floor`,`additional_monthly_payment`,`is_secured`,`secured_asset`,`draw_period_end_date`,`repayment_period_end_date`,`interest_type`,`prime_rate_margin`,`annual_fee`,`annual_fee_month`,`annual_fee_bill_id`,`auto_create_payment_bill`,`include_in_payoff_strategy`,`budgeted_monthly_payment`,`created_at`,`updated_at`,`include_in_discretionary`,`current_balance_cents`,`available_balance_cents`,`credit_limit_cents`,`entity_id`)
SELECT `id`,`user_id`,`household_id`,`name`,`type`,`bank_name`,`account_number_last4`,`current_balance`,`available_balance`,`credit_limit`,`is_active`,`is_business_account`,`enable_sales_tax`,`enable_tax_deductions`,`color`,`icon`,`sort_order`,`usage_count`,`last_used_at`,`statement_balance`,`statement_date`,`statement_due_date`,`minimum_payment_amount`,`last_statement_updated`,`interest_rate`,`minimum_payment_percent`,`minimum_payment_floor`,`additional_monthly_payment`,`is_secured`,`secured_asset`,`draw_period_end_date`,`repayment_period_end_date`,`interest_type`,`prime_rate_margin`,`annual_fee`,`annual_fee_month`,`annual_fee_bill_id`,`auto_create_payment_bill`,`include_in_payoff_strategy`,`budgeted_monthly_payment`,`created_at`,`updated_at`,`include_in_discretionary`,`current_balance_cents`,`available_balance_cents`,`credit_limit_cents`,`entity_id` FROM `accounts`;--> statement-breakpoint
INSERT INTO `__strict_transactions` (`id`,`user_id`,`household_id`,`account_id`,`category_id`,`merchant_id`,`bill_id`,`debt_id`,`savings_goal_id`,`date`,`amount`,`description`,`notes`,`type`,`transfer_id`,`is_pending`,`is_recurring`,`recurring_rule`,`receipt_url`,`is_split`,`split_parent_id`,`is_tax_deductible`,`tax_deduction_type`,`is_sales_taxable`,`is_balance_transfer`,`is_refund`,`import_history_id`,`import_row_number`,`sync_status`,`offline_id`,`synced_at`,`sync_error`,`sync_attempts`,`created_at`,`updated_at`,`transfer_source_account_id`,`transfer_destination_account_id`,`amount_cents`,`transfer_group_id`,`paired_transaction_id`,`entity_id`)
SELECT `id`,`user_id`,`household_id`,`account_id`,`category_id`,`merchant_id`,`bill_id`,`debt_id`,`savings_goal_id`,`date`,`amount`,`description`,`notes`,`type`,`transfer_id`,`is_pending`,`is_recurring`,`recurring_rule`,`receipt_url`,`is_split`,`split_parent_id`,`is_tax_deductible`,`tax_deduction_type`,`is_sales_taxable`,`is_balance_transfer`,`is_refund`,`import_history_id`,`import_row_number`,`sync_status`,`offline_id`,`synced_at`,`sync_error`,`sync_attempts`,`created_at`,`updated_at`,`transfer_source_account_id`,`transfer_destination_account_id`,`amount_cents`,`transfer_group_id`,`paired_transaction_id`,`entity_id` FROM `transactions`;--> statement-breakpoint
INSERT INTO `__strict_debts` (`id`,`user_id`,`household_id`,`name`,`description`,`creditor_name`,`original_amount`,`remaining_balance`,`minimum_payment`,`additional_monthly_payment`,`interest_rate`,`interest_type`,`account_id`,`category_id`,`type`,`color`,`icon`,`start_date`,`target_payoff_date`,`status`,`priority`,`loan_type`,`loan_term_months`,`origination_date`,`compounding_frequency`,`billing_cycle_days`,`last_statement_date`,`last_statement_balance`,`credit_limit`,`notes`,`created_at`,`updated_at`,`remaining_balance_cents`)
SELECT `id`,`user_id`,`household_id`,`name`,`description`,`creditor_name`,`original_amount`,`remaining_balance`,`minimum_payment`,`additional_monthly_payment`,`interest_rate`,`interest_type`,`account_id`,`category_id`,`type`,`color`,`icon`,`start_date`,`target_payoff_date`,`status`,`priority`,`loan_type`,`loan_term_months`,`origination_date`,`compounding_frequency`,`billing_cycle_days`,`last_statement_date`,`last_statement_balance`,`credit_limit`,`notes`,`created_at`,`updated_at`,`remaining_balance_cents` FROM `debts`;--> statement-breakpoint
INSERT INTO `__strict_savings_goals` (`id`,`user_id`,`household_id`,`name`,`description`,`target_amount`,`current_amount`,`account_id`,`category`,`color`,`icon`,`target_date`,`status`,`priority`,`monthly_contribution`,`notes`,`created_at`,`updated_at`,`current_amount_cents`,`target_amount_cents`)
SELECT `id`,`user_id`,`household_id`,`name`,`description`,`target_amount`,`current_amount`,`account_id`,`category`,`color`,`icon`,`target_date`,`status`,`priority`,`monthly_contribution`,`notes`,`created_at`,`updated_at`,`current_amount_cents`,`target_amount_cents` FROM `savings_goals`;--> statement-breakpoint
INSERT INTO `__strict_bill_occurrences` (`id`,`template_id`,`household_id`,`due_date`,`status`,`amount_due_cents`,`amount_paid_cents`,`amount_remaining_cents`,`actual_amount_cents`,`paid_date`,`last_transaction_id`,`days_late`,`late_fee_cents`,`is_manual_override`,`budget_period_override`,`notes`,`created_at`,`updated_at`)
SELECT `id`,`template_id`,`household_id`,`due_date`,`status`,`amount_due_cents`,`amount_paid_cents`,`amount_remaining_cents`,`actual_amount_cents`,`paid_date`,`last_transaction_id`,`days_late`,`late_fee_cents`,`is_manual_override`,`budget_period_override`,`notes`,`created_at`,`updated_at` FROM `bill_occurrences`;--> statement-breakpoint
INSERT INTO `__strict_transaction_splits` (`id`,`user_id`,`household_id`,`transaction_id`,`category_id`,`amount`,`description`,`percentage`,`is_percentage`,`sort_order`,`notes`,`created_at`,`updated_at`,`amount_cents`)
SELECT `id`,`user_id`,`household_id`,`transaction_id`,`category_id`,`amount`,`description`,`percentage`,`is_percentage`,`sort_order`,`notes`,`created_at`,`updated_at`,`amount_cents` FROM `transaction_splits`;--> statement-breakpoint
INSERT INTO `__strict_transaction_tags` (`id`,`user_id`,`transaction_id`,`tag_id`,`created_at`)
SELECT `id`,`user_id`,`transaction_id`,`tag_id`,`created_at` FROM `transaction_tags`;--> statement-breakpoint
INSERT INTO `__strict_custom_field_values` (`id`,`user_id`,`custom_field_id`,`transaction_id`,`value`,`created_at`,`updated_at`)
SELECT `id`,`user_id`,`custom_field_id`,`transaction_id`,`value`,`created_at`,`updated_at` FROM `custom_field_values`;--> statement-breakpoint
INSERT INTO `__strict_debt_payments` (`id`,`debt_id`,`user_id`,`household_id`,`amount`,`principal_amount`,`interest_amount`,`payment_date`,`transaction_id`,`notes`,`created_at`,`amount_cents`,`principal_cents`,`interest_cents`)
SELECT `id`,`debt_id`,`user_id`,`household_id`,`amount`,`principal_amount`,`interest_amount`,`payment_date`,`transaction_id`,`notes`,`created_at`,`amount_cents`,`principal_cents`,`interest_cents` FROM `debt_payments`;--> statement-breakpoint
INSERT INTO `__strict_savings_goal_contributions` (`id`,`transaction_id`,`goal_id`,`user_id`,`household_id`,`amount`,`created_at`,`amount_cents`)
SELECT `id`,`transaction_id`,`goal_id`,`user_id`,`household_id`,`amount`,`created_at`,`amount_cents` FROM `savings_goal_contributions`;--> statement-breakpoint
INSERT INTO `__strict_bill_payment_events` (`id`,`household_id`,`template_id`,`occurrence_id`,`transaction_id`,`amount_cents`,`principal_cents`,`interest_cents`,`balance_before_cents`,`balance_after_cents`,`payment_date`,`payment_method`,`source_account_id`,`idempotency_key`,`notes`,`created_at`)
SELECT `id`,`household_id`,`template_id`,`occurrence_id`,`transaction_id`,`amount_cents`,`principal_cents`,`interest_cents`,`balance_before_cents`,`balance_after_cents`,`payment_date`,`payment_method`,`source_account_id`,`idempotency_key`,`notes`,`created_at` FROM `bill_payment_events`;--> statement-breakpoint
INSERT INTO `__strict_transfers` (`id`,`user_id`,`from_account_id`,`to_account_id`,`amount`,`description`,`date`,`status`,`from_transaction_id`,`to_transaction_id`,`fees`,`notes`,`created_at`,`household_id`,`amount_cents`,`fees_cents`)
SELECT `id`,`user_id`,`from_account_id`,`to_account_id`,`amount`,`description`,`date`,`status`,`from_transaction_id`,`to_transaction_id`,`fees`,`notes`,`created_at`,`household_id`,`amount_cents`,`fees_cents` FROM `transfers`;--> statement-breakpoint
-- ============== drop: children first, then unreferenced parents ==============
DROP TABLE `transaction_splits`;--> statement-breakpoint
DROP TABLE `transaction_tags`;--> statement-breakpoint
DROP TABLE `custom_field_values`;--> statement-breakpoint
DROP TABLE `debt_payments`;--> statement-breakpoint
DROP TABLE `savings_goal_contributions`;--> statement-breakpoint
DROP TABLE `bill_payment_events`;--> statement-breakpoint
DROP TABLE `transfers`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
DROP TABLE `debts`;--> statement-breakpoint
DROP TABLE `savings_goals`;--> statement-breakpoint
DROP TABLE `bill_occurrences`;--> statement-breakpoint
-- ============ rename: parents first (RENAME fixes child FK refs) ============
ALTER TABLE `__strict_accounts` RENAME TO `accounts`;--> statement-breakpoint
ALTER TABLE `__strict_transactions` RENAME TO `transactions`;--> statement-breakpoint
ALTER TABLE `__strict_debts` RENAME TO `debts`;--> statement-breakpoint
ALTER TABLE `__strict_savings_goals` RENAME TO `savings_goals`;--> statement-breakpoint
ALTER TABLE `__strict_bill_occurrences` RENAME TO `bill_occurrences`;--> statement-breakpoint
ALTER TABLE `__strict_transaction_splits` RENAME TO `transaction_splits`;--> statement-breakpoint
ALTER TABLE `__strict_transaction_tags` RENAME TO `transaction_tags`;--> statement-breakpoint
ALTER TABLE `__strict_custom_field_values` RENAME TO `custom_field_values`;--> statement-breakpoint
ALTER TABLE `__strict_debt_payments` RENAME TO `debt_payments`;--> statement-breakpoint
ALTER TABLE `__strict_savings_goal_contributions` RENAME TO `savings_goal_contributions`;--> statement-breakpoint
ALTER TABLE `__strict_bill_payment_events` RENAME TO `bill_payment_events`;--> statement-breakpoint
ALTER TABLE `__strict_transfers` RENAME TO `transfers`;--> statement-breakpoint
-- ============================ indexes: accounts ============================
CREATE INDEX `idx_accounts_user` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_accounts_household` ON `accounts` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_accounts_user_household` ON `accounts` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_accounts_user_usage` ON `accounts` (`user_id`,`usage_count`);--> statement-breakpoint
CREATE INDEX `idx_accounts_user_active` ON `accounts` (`user_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_accounts_interest_rate` ON `accounts` (`interest_rate`);--> statement-breakpoint
CREATE INDEX `idx_accounts_include_in_strategy` ON `accounts` (`include_in_payoff_strategy`);--> statement-breakpoint
CREATE INDEX `idx_accounts_current_balance_cents` ON `accounts` (`current_balance_cents`);--> statement-breakpoint
CREATE INDEX `idx_accounts_entity` ON `accounts` (`entity_id`);--> statement-breakpoint
-- ========================== indexes: transactions ==========================
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
CREATE INDEX `idx_transactions_transfer_source_account` ON `transactions` (`transfer_source_account_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_transfer_destination_account` ON `transactions` (`transfer_destination_account_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_amount_cents` ON `transactions` (`amount_cents`);--> statement-breakpoint
CREATE INDEX `idx_transactions_transfer_group` ON `transactions` (`transfer_group_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_paired_transaction` ON `transactions` (`paired_transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_entity` ON `transactions` (`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transactions_household_offline_unique` ON `transactions` (`household_id`, `offline_id`) WHERE `offline_id` IS NOT NULL;--> statement-breakpoint
-- ============================= indexes: debts =============================
CREATE INDEX `idx_debts_user` ON `debts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_household` ON `debts` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_user_household` ON `debts` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_status` ON `debts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_debts_category` ON `debts` (`category_id`);--> statement-breakpoint
-- ========================= indexes: savings_goals =========================
CREATE INDEX `idx_savings_goals_user` ON `savings_goals` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_goals_household` ON `savings_goals` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_goals_user_household` ON `savings_goals` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_goals_status` ON `savings_goals` (`status`);--> statement-breakpoint
-- ======================== indexes: bill_occurrences ========================
CREATE UNIQUE INDEX `idx_bill_occurrences_template_due` ON `bill_occurrences` (`template_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_bill_occurrences_household_due` ON `bill_occurrences` (`household_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_bill_occurrences_household_status_due` ON `bill_occurrences` (`household_id`,`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_bill_occurrences_template` ON `bill_occurrences` (`template_id`);--> statement-breakpoint
-- ======================= indexes: transaction_splits =======================
CREATE INDEX `idx_transaction_splits` ON `transaction_splits` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user` ON `transaction_splits` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_household` ON `transaction_splits` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user_household` ON `transaction_splits` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_category` ON `transaction_splits` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user_tx` ON `transaction_splits` (`user_id`,`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_amount_cents` ON `transaction_splits` (`amount_cents`);--> statement-breakpoint
-- ======================== indexes: transaction_tags ========================
CREATE UNIQUE INDEX `idx_transaction_tags_unique` ON `transaction_tags` (`transaction_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_user` ON `transaction_tags` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_transaction` ON `transaction_tags` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_tag` ON `transaction_tags` (`tag_id`);--> statement-breakpoint
-- ====================== indexes: custom_field_values ======================
CREATE UNIQUE INDEX `idx_custom_field_values_unique` ON `custom_field_values` (`custom_field_id`,`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_custom_field_values_user` ON `custom_field_values` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_custom_field_values_field` ON `custom_field_values` (`custom_field_id`);--> statement-breakpoint
CREATE INDEX `idx_custom_field_values_transaction` ON `custom_field_values` (`transaction_id`);--> statement-breakpoint
-- ========================= indexes: debt_payments =========================
CREATE INDEX `idx_debt_payments_user` ON `debt_payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payments_household` ON `debt_payments` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payments_user_household` ON `debt_payments` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payments_debt` ON `debt_payments` (`debt_id`);--> statement-breakpoint
-- ================== indexes: savings_goal_contributions ==================
CREATE INDEX `idx_goal_contributions_transaction` ON `savings_goal_contributions` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_goal` ON `savings_goal_contributions` (`goal_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_user_household` ON `savings_goal_contributions` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_goal_created` ON `savings_goal_contributions` (`goal_id`,`created_at`);--> statement-breakpoint
-- ====================== indexes: bill_payment_events ======================
CREATE UNIQUE INDEX `idx_bill_payment_events_idempotency` ON `bill_payment_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_bill_payment_events_household_date` ON `bill_payment_events` (`household_id`,`payment_date`);--> statement-breakpoint
CREATE INDEX `idx_bill_payment_events_occurrence` ON `bill_payment_events` (`occurrence_id`);--> statement-breakpoint
-- =========================== indexes: transfers ===========================
CREATE INDEX `idx_transfers_user` ON `transfers` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transfers_household` ON `transfers` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transfers_user_household` ON `transfers` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transfers_amount_cents` ON `transfers` (`amount_cents`);--> statement-breakpoint
CREATE INDEX `idx_transfers_fees_cents` ON `transfers` (`fees_cents`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transfers_from_transaction_unique` ON `transfers` (`from_transaction_id`) WHERE `from_transaction_id` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transfers_to_transaction_unique` ON `transfers` (`to_transaction_id`) WHERE `to_transaction_id` IS NOT NULL;--> statement-breakpoint
-- ====================== triggers: accounts (4) ======================
CREATE TRIGGER trg_accounts_sync_money_cents_insert
AFTER INSERT ON accounts
BEGIN
  UPDATE accounts
  SET
    current_balance_cents = CAST(ROUND(COALESCE(NEW.current_balance, 0) * 100) AS INTEGER),
    available_balance_cents = CASE
      WHEN NEW.available_balance IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.available_balance * 100) AS INTEGER)
    END,
    credit_limit_cents = CASE
      WHEN NEW.credit_limit IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.credit_limit * 100) AS INTEGER)
    END
  WHERE id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_accounts_sync_money_cents_update
AFTER UPDATE OF current_balance, available_balance, credit_limit ON accounts
BEGIN
  UPDATE accounts
  SET
    current_balance_cents = CAST(ROUND(COALESCE(NEW.current_balance, 0) * 100) AS INTEGER),
    available_balance_cents = CASE
      WHEN NEW.available_balance IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.available_balance * 100) AS INTEGER)
    END,
    credit_limit_cents = CASE
      WHEN NEW.credit_limit IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.credit_limit * 100) AS INTEGER)
    END
  WHERE id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_accounts_money_cents_guard_insert
AFTER INSERT ON accounts
BEGIN
  SELECT CASE
    WHEN (
      a.current_balance_cents IS NULL
      OR ABS(COALESCE(a.current_balance, 0) - (a.current_balance_cents / 100.0)) > 0.000001
      OR NOT (
        (a.available_balance IS NULL AND a.available_balance_cents IS NULL)
        OR (
          a.available_balance IS NOT NULL
          AND a.available_balance_cents IS NOT NULL
          AND ABS(a.available_balance - (a.available_balance_cents / 100.0)) <= 0.000001
        )
      )
      OR NOT (
        (a.credit_limit IS NULL AND a.credit_limit_cents IS NULL)
        OR (
          a.credit_limit IS NOT NULL
          AND a.credit_limit_cents IS NOT NULL
          AND ABS(a.credit_limit - (a.credit_limit_cents / 100.0)) <= 0.000001
        )
      )
    )
    THEN RAISE(ABORT, 'accounts money cents integrity check failed')
  END
  FROM accounts a
  WHERE a.id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_accounts_money_cents_guard_update
AFTER UPDATE OF current_balance_cents, available_balance_cents, credit_limit_cents ON accounts
BEGIN
  SELECT CASE
    WHEN (
      a.current_balance_cents IS NULL
      OR ABS(COALESCE(a.current_balance, 0) - (a.current_balance_cents / 100.0)) > 0.000001
      OR NOT (
        (a.available_balance IS NULL AND a.available_balance_cents IS NULL)
        OR (
          a.available_balance IS NOT NULL
          AND a.available_balance_cents IS NOT NULL
          AND ABS(a.available_balance - (a.available_balance_cents / 100.0)) <= 0.000001
        )
      )
      OR NOT (
        (a.credit_limit IS NULL AND a.credit_limit_cents IS NULL)
        OR (
          a.credit_limit IS NOT NULL
          AND a.credit_limit_cents IS NOT NULL
          AND ABS(a.credit_limit - (a.credit_limit_cents / 100.0)) <= 0.000001
        )
      )
    )
    THEN RAISE(ABORT, 'accounts money cents integrity check failed')
  END
  FROM accounts a
  WHERE a.id = NEW.id;
END;--> statement-breakpoint
-- ====================== triggers: transactions (4) ======================
CREATE TRIGGER trg_transactions_sync_amount_cents_insert
AFTER INSERT ON transactions
BEGIN
  UPDATE transactions
  SET amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_transactions_sync_amount_cents_update
AFTER UPDATE OF amount ON transactions
BEGIN
  UPDATE transactions
  SET amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_transactions_money_cents_guard_insert
AFTER INSERT ON transactions
BEGIN
  SELECT CASE
    WHEN (
      t.amount_cents IS NULL
      OR ABS(t.amount - (t.amount_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transactions money cents integrity check failed')
  END
  FROM transactions t
  WHERE t.id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_transactions_money_cents_guard_update
AFTER UPDATE OF amount_cents ON transactions
BEGIN
  SELECT CASE
    WHEN (
      t.amount_cents IS NULL
      OR ABS(t.amount - (t.amount_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transactions money cents integrity check failed')
  END
  FROM transactions t
  WHERE t.id = NEW.id;
END;--> statement-breakpoint
-- ==================== triggers: transaction_splits (4) ====================
CREATE TRIGGER trg_transaction_splits_sync_amount_cents_insert
AFTER INSERT ON transaction_splits
BEGIN
  UPDATE transaction_splits
  SET amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_transaction_splits_sync_amount_cents_update
AFTER UPDATE OF amount ON transaction_splits
BEGIN
  UPDATE transaction_splits
  SET amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_transaction_splits_money_cents_guard_insert
AFTER INSERT ON transaction_splits
BEGIN
  SELECT CASE
    WHEN (
      ts.amount_cents IS NULL
      OR ABS(ts.amount - (ts.amount_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transaction_splits money cents integrity check failed')
  END
  FROM transaction_splits ts
  WHERE ts.id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_transaction_splits_money_cents_guard_update
AFTER UPDATE OF amount_cents ON transaction_splits
BEGIN
  SELECT CASE
    WHEN (
      ts.amount_cents IS NULL
      OR ABS(ts.amount - (ts.amount_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transaction_splits money cents integrity check failed')
  END
  FROM transaction_splits ts
  WHERE ts.id = NEW.id;
END;--> statement-breakpoint
-- ======================= triggers: transfers (4) =======================
CREATE TRIGGER trg_transfers_sync_amount_cents_insert
AFTER INSERT ON transfers
BEGIN
  UPDATE transfers
  SET
    amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER),
    fees_cents = CAST(ROUND(COALESCE(NEW.fees, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_transfers_sync_amount_cents_update
AFTER UPDATE OF amount, fees ON transfers
BEGIN
  UPDATE transfers
  SET
    amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER),
    fees_cents = CAST(ROUND(COALESCE(NEW.fees, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_transfers_money_cents_guard_insert
AFTER INSERT ON transfers
BEGIN
  SELECT CASE
    WHEN (
      tr.amount_cents IS NULL
      OR tr.fees_cents IS NULL
      OR ABS(tr.amount - (tr.amount_cents / 100.0)) > 0.000001
      OR ABS(COALESCE(tr.fees, 0) - (tr.fees_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transfers money cents integrity check failed')
  END
  FROM transfers tr
  WHERE tr.id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER trg_transfers_money_cents_guard_update
AFTER UPDATE OF amount_cents, fees_cents ON transfers
BEGIN
  SELECT CASE
    WHEN (
      tr.amount_cents IS NULL
      OR tr.fees_cents IS NULL
      OR ABS(tr.amount - (tr.amount_cents / 100.0)) > 0.000001
      OR ABS(COALESCE(tr.fees, 0) - (tr.fees_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transfers money cents integrity check failed')
  END
  FROM transfers tr
  WHERE tr.id = NEW.id;
END;
