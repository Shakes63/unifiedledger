ALTER TABLE transactions ADD COLUMN transfer_source_account_id TEXT;--> statement-breakpoint
ALTER TABLE transactions ADD COLUMN transfer_destination_account_id TEXT;--> statement-breakpoint
UPDATE transactions
SET transfer_source_account_id = CASE
  WHEN type = 'transfer_out' THEN account_id
  WHEN type = 'transfer_in' THEN COALESCE(
    NULLIF(merchant_id, ''),
    (
      SELECT paired.account_id
      FROM transactions AS paired
      WHERE paired.id = transactions.transfer_id
        AND paired.type = 'transfer_out'
        AND paired.household_id = transactions.household_id
      LIMIT 1
    ),
    (
      SELECT paired.account_id
      FROM transactions AS paired
      WHERE paired.transfer_id = transactions.transfer_id
        AND paired.type = 'transfer_out'
        AND paired.household_id = transactions.household_id
      LIMIT 1
    )
  )
  ELSE transfer_source_account_id
END
WHERE type IN ('transfer_out', 'transfer_in')
  AND transfer_source_account_id IS NULL;--> statement-breakpoint
UPDATE transactions
SET transfer_destination_account_id = CASE
  WHEN type = 'transfer_out' THEN COALESCE(
    (
      SELECT a.id
      FROM accounts AS a
      WHERE a.id = transactions.transfer_id
        AND a.household_id = transactions.household_id
      LIMIT 1
    ),
    (
      SELECT paired.account_id
      FROM transactions AS paired
      WHERE paired.transfer_id = transactions.transfer_id
        AND paired.type = 'transfer_in'
        AND paired.household_id = transactions.household_id
      LIMIT 1
    )
  )
  WHEN type = 'transfer_in' THEN account_id
  ELSE transfer_destination_account_id
END
WHERE type IN ('transfer_out', 'transfer_in')
  AND transfer_destination_account_id IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_source_account ON transactions(transfer_source_account_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_destination_account ON transactions(transfer_destination_account_id);
