ALTER TABLE transactions ADD COLUMN transfer_group_id TEXT;--> statement-breakpoint
ALTER TABLE transactions ADD COLUMN paired_transaction_id TEXT;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group ON transactions(transfer_group_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_paired_transaction ON transactions(paired_transaction_id);--> statement-breakpoint

ALTER TABLE transfer_suggestions ADD COLUMN household_id TEXT;--> statement-breakpoint
UPDATE transfer_suggestions
SET household_id = (
  SELECT t.household_id
  FROM transactions AS t
  WHERE t.id = transfer_suggestions.source_transaction_id
  LIMIT 1
)
WHERE household_id IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfer_suggestions_household ON transfer_suggestions(household_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfer_suggestions_user_household ON transfer_suggestions(user_id, household_id);
