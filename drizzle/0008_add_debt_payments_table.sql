-- Migration: Add debt_payments table and fix debt_payoff_milestones structure
-- This creates the missing debt_payments table and updates debt_payoff_milestones to match the schema

-- Create debt_payments table
CREATE TABLE `debt_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`payment_date` text NOT NULL,
	`transaction_id` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now'))
);

-- Create indexes for debt_payments
CREATE INDEX `idx_debt_payments_user` ON `debt_payments` (`user_id`);
CREATE INDEX `idx_debt_payments_debt` ON `debt_payments` (`debt_id`);

-- Recreate debt_payoff_milestones with correct structure
-- First, backup any existing data
CREATE TABLE `__old_debt_payoff_milestones` AS SELECT * FROM `debt_payoff_milestones`;

-- Drop old table
DROP TABLE `debt_payoff_milestones`;

-- Create new structure matching schema
CREATE TABLE `debt_payoff_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`user_id` text NOT NULL,
	`percentage` integer NOT NULL,
	`milestone_balance` real NOT NULL,
	`achieved_at` text,
	`notification_sent_at` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now'))
);

-- Create indexes for debt_payoff_milestones
CREATE INDEX `idx_debt_payoff_milestones_user` ON `debt_payoff_milestones` (`user_id`);
CREATE INDEX `idx_debt_payoff_milestones_debt` ON `debt_payoff_milestones` (`debt_id`);

-- Add missing index for debts table
CREATE INDEX `idx_debts_status` ON `debts` (`status`);
