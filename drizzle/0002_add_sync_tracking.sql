-- Add sync tracking fields to transactions table for offline support
ALTER TABLE `transactions` ADD COLUMN `sync_status` text DEFAULT 'synced';--> statement-breakpoint
ALTER TABLE `transactions` ADD COLUMN `offline_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD COLUMN `synced_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD COLUMN `sync_error` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD COLUMN `sync_attempts` integer DEFAULT 0;--> statement-breakpoint

-- Create indexes for efficient sync status queries
CREATE INDEX `idx_transactions_sync_status` ON `transactions` (`sync_status`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_sync` ON `transactions` (`user_id`,`sync_status`);--> statement-breakpoint
CREATE INDEX `idx_transactions_offline_id` ON `transactions` (`offline_id`);
