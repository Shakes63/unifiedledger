-- Migration: Add debt_id column to bills table
-- This allows bills to be linked to debts for automatic debt payment tracking

ALTER TABLE `bills` ADD COLUMN `debt_id` text;
