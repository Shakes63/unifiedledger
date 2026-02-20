ALTER TABLE transfers ADD COLUMN IF NOT EXISTS household_id TEXT;--> statement-breakpoint
UPDATE transfers t
SET household_id = COALESCE(
  (SELECT tr.household_id FROM transactions tr WHERE tr.id = t.from_transaction_id),
  (SELECT tr.household_id FROM transactions tr WHERE tr.id = t.to_transaction_id),
  (SELECT a.household_id FROM accounts a WHERE a.id = t.from_account_id),
  (SELECT a.household_id FROM accounts a WHERE a.id = t.to_account_id)
)
WHERE t.household_id IS NULL;--> statement-breakpoint
ALTER TABLE transfers ALTER COLUMN household_id SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_household ON transfers(household_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_user_household ON transfers(user_id, household_id);
