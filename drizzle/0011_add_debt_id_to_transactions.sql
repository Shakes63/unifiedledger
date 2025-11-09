-- Migration: Add debt_id column to transactions table
-- This allows transactions to be directly linked to debts for manual/irregular payments

ALTER TABLE `transactions` ADD COLUMN `debt_id` text;
