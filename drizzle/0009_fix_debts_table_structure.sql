-- Migration: Fix debts table structure to match current schema
-- This recreates the debts table with the correct column names

-- Step 1: Rename debts table to backup
ALTER TABLE `debts` RENAME TO `__old_debts`;

-- Step 2: Create new debts table with correct structure
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`creditor_name` text NOT NULL,
	`original_amount` real NOT NULL,
	`remaining_balance` real NOT NULL,
	`minimum_payment` real,
	`interest_rate` real DEFAULT 0,
	`interest_type` text DEFAULT 'none',
	`account_id` text,
	`type` text DEFAULT 'other',
	`color` text DEFAULT '#ef4444',
	`icon` text DEFAULT 'credit-card',
	`start_date` text NOT NULL,
	`target_payoff_date` text,
	`status` text DEFAULT 'active',
	`priority` integer DEFAULT 0,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);

-- Step 3: Copy data from old table to new table
-- Map old columns to new columns
INSERT INTO `debts` (
	id, user_id, name, description, creditor_name, original_amount, remaining_balance,
	minimum_payment, interest_rate, interest_type, account_id, type, color, icon,
	start_date, target_payoff_date, status, priority, notes, created_at, updated_at
)
SELECT
	id,
	user_id,
	name,
	COALESCE(description, NULL),
	COALESCE(creditor_name, ''),
	COALESCE(original_amount, current_balance),
	COALESCE(remaining_balance, current_balance),
	minimum_payment,
	COALESCE(interest_rate, 0),
	COALESCE(interest_type, 'none'),
	account_id,
	COALESCE(type, 'other'),
	COALESCE(color, '#ef4444'),
	COALESCE(icon, 'credit-card'),
	COALESCE(start_date, date('now')),
	target_payoff_date,
	COALESCE(status, 'active'),
	COALESCE(priority, priority_order, 0),
	notes,
	created_at,
	COALESCE(updated_at, created_at)
FROM `__old_debts`;

-- Step 4: Drop old indexes if they exist and create new ones
DROP INDEX IF EXISTS `idx_debts_user`;
DROP INDEX IF EXISTS `idx_debts_status`;
CREATE INDEX `idx_debts_user` ON `debts` (`user_id`);
CREATE INDEX `idx_debts_status` ON `debts` (`status`);

-- Step 5: Drop old table
DROP TABLE `__old_debts`;
