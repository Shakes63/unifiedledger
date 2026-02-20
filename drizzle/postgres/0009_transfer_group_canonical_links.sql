ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_group_id TEXT;--> statement-breakpoint
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paired_transaction_id TEXT;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group ON transactions(transfer_group_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_paired_transaction ON transactions(paired_transaction_id);--> statement-breakpoint

ALTER TABLE transfer_suggestions ADD COLUMN IF NOT EXISTS household_id TEXT;--> statement-breakpoint
UPDATE transfer_suggestions ts
SET household_id = t.household_id
FROM transactions t
WHERE ts.source_transaction_id = t.id
  AND ts.household_id IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfer_suggestions_household ON transfer_suggestions(household_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfer_suggestions_user_household ON transfer_suggestions(user_id, household_id);
