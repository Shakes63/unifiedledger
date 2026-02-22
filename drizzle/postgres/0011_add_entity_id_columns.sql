ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "entity_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "entity_id" text;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_accounts_entity" ON "accounts" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_entity" ON "transactions" USING btree ("entity_id");
