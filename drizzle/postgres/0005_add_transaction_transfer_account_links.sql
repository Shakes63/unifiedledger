ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_source_account_id TEXT;--> statement-breakpoint
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_destination_account_id TEXT;--> statement-breakpoint
UPDATE transactions t
SET transfer_source_account_id = CASE
  WHEN t.type = 'transfer_out' THEN t.account_id
  WHEN t.type = 'transfer_in' THEN COALESCE(
    NULLIF(t.merchant_id, ''),
    (
      SELECT paired.account_id
      FROM transactions paired
      WHERE paired.id = t.transfer_id
        AND paired.type = 'transfer_out'
        AND paired.household_id = t.household_id
      LIMIT 1
    ),
    (
      SELECT paired.account_id
      FROM transactions paired
      WHERE paired.transfer_id = t.transfer_id
        AND paired.type = 'transfer_out'
        AND paired.household_id = t.household_id
      LIMIT 1
    )
  )
  ELSE t.transfer_source_account_id
END
WHERE t.type IN ('transfer_out', 'transfer_in')
  AND t.transfer_source_account_id IS NULL;--> statement-breakpoint
UPDATE transactions t
SET transfer_destination_account_id = CASE
  WHEN t.type = 'transfer_out' THEN COALESCE(
    (
      SELECT a.id
      FROM accounts a
      WHERE a.id = t.transfer_id
        AND a.household_id = t.household_id
      LIMIT 1
    ),
    (
      SELECT paired.account_id
      FROM transactions paired
      WHERE paired.transfer_id = t.transfer_id
        AND paired.type = 'transfer_in'
        AND paired.household_id = t.household_id
      LIMIT 1
    )
  )
  WHEN t.type = 'transfer_in' THEN t.account_id
  ELSE t.transfer_destination_account_id
END
WHERE t.type IN ('transfer_out', 'transfer_in')
  AND t.transfer_destination_account_id IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_source_account ON transactions(transfer_source_account_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_destination_account ON transactions(transfer_destination_account_id);
