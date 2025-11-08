-- Add is_tax_deductible column to budget_categories table
ALTER TABLE `budget_categories` ADD COLUMN `is_tax_deductible` integer DEFAULT 0;
