ALTER TABLE accounts ADD COLUMN entity_id text;--> statement-breakpoint
ALTER TABLE transactions ADD COLUMN entity_id text;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_accounts_entity ON accounts(entity_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_entity ON transactions(entity_id);
