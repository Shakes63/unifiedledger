-- Migration: Add business category flag to budget_categories table
-- Allows categories to be marked as business-related for better organization
-- Date: 2025-12-01

-- Add is_business_category column to budget_categories table
ALTER TABLE `budget_categories` ADD COLUMN `is_business_category` integer DEFAULT 0;

-- Add index for efficient querying of business vs personal categories
CREATE INDEX IF NOT EXISTS `idx_budget_categories_business` ON `budget_categories` (`is_business_category`);

