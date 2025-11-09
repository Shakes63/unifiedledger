-- Migration: Add frequency column to bills table
-- This allows bills to be monthly, quarterly, semi-annual, or annual

ALTER TABLE `bills` ADD COLUMN `frequency` text DEFAULT 'monthly';
