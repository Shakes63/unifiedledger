-- Transaction Audit Log table for tracking all changes to transactions
-- Stores field-level changes, snapshots for deletions, and user information

CREATE TABLE IF NOT EXISTS `transaction_audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `transaction_id` text NOT NULL,
  `user_id` text NOT NULL,
  `household_id` text NOT NULL,
  `user_name` text,
  `action_type` text NOT NULL,
  `changes` text,
  `snapshot` text,
  `ip_address` text,
  `user_agent` text,
  `created_at` text DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS `idx_transaction_audit_log_transaction` ON `transaction_audit_log` (`transaction_id`);
CREATE INDEX IF NOT EXISTS `idx_transaction_audit_log_user` ON `transaction_audit_log` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_transaction_audit_log_household` ON `transaction_audit_log` (`household_id`);
CREATE INDEX IF NOT EXISTS `idx_transaction_audit_log_created` ON `transaction_audit_log` (`created_at`);
CREATE INDEX IF NOT EXISTS `idx_transaction_audit_log_tx_created` ON `transaction_audit_log` (`transaction_id`, `created_at`);







