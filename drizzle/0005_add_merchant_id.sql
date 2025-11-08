-- Add merchant_id column to transactions table
ALTER TABLE `transactions` ADD COLUMN `merchant_id` text;

-- Add index for merchant_id queries
CREATE INDEX `idx_transactions_merchant` ON `transactions` (`merchant_id`);
