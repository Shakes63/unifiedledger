-- Add is_business_account column to accounts table
ALTER TABLE `accounts` ADD COLUMN `is_business_account` integer DEFAULT 0;
