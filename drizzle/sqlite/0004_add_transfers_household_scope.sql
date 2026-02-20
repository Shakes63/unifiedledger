ALTER TABLE transfers ADD COLUMN household_id TEXT;--> statement-breakpoint
UPDATE transfers
SET household_id = COALESCE(
  (SELECT household_id FROM transactions WHERE transactions.id = transfers.from_transaction_id),
  (SELECT household_id FROM transactions WHERE transactions.id = transfers.to_transaction_id),
  (SELECT household_id FROM accounts WHERE accounts.id = transfers.from_account_id),
  (SELECT household_id FROM accounts WHERE accounts.id = transfers.to_account_id)
)
WHERE household_id IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_household ON transfers(household_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_user_household ON transfers(user_id, household_id);
