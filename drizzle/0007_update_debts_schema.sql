-- Migration: Update debts table to match current schema
-- This adds missing columns that are referenced in the code but not in the database

-- Add new columns to debts table
ALTER TABLE `debts` ADD COLUMN `description` text;
ALTER TABLE `debts` ADD COLUMN `creditor_name` text NOT NULL DEFAULT '';
ALTER TABLE `debts` ADD COLUMN `original_amount` real NOT NULL DEFAULT 0;
ALTER TABLE `debts` ADD COLUMN `remaining_balance` real NOT NULL DEFAULT 0;
ALTER TABLE `debts` ADD COLUMN `interest_type` text DEFAULT 'none';
ALTER TABLE `debts` ADD COLUMN `type` text DEFAULT 'other';
ALTER TABLE `debts` ADD COLUMN `color` text DEFAULT '#ef4444';
ALTER TABLE `debts` ADD COLUMN `icon` text DEFAULT 'credit-card';
ALTER TABLE `debts` ADD COLUMN `start_date` text;
ALTER TABLE `debts` ADD COLUMN `target_payoff_date` text;
ALTER TABLE `debts` ADD COLUMN `status` text DEFAULT 'active';
ALTER TABLE `debts` ADD COLUMN `priority` integer DEFAULT 0;
ALTER TABLE `debts` ADD COLUMN `notes` text;
ALTER TABLE `debts` ADD COLUMN `updated_at` text;

-- Update old columns to map to new schema
-- Note: We'll need to copy data from old columns to new columns if there's existing data
-- For now, this migration just adds the new columns
