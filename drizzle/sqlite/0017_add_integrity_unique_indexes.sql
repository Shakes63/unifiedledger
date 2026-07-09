-- H-TXN-7 / M-DB-2: unique indexes that make money duplication structurally
-- impossible instead of convention-enforced.
--
-- 1) (household_id, offline_id) on transactions: an offline client retrying a
--    create can no longer insert the same transaction twice.
-- 2) transfers.from_transaction_id / to_transaction_id: a transaction can be the
--    leg of AT MOST ONE transfer, so a retry bug can't double-count a movement.
--
-- Pre-clean (no-ops on healthy databases, conservative on corrupted ones):
-- duplicate offline_ids keep the earliest transaction and clear the marker on
-- later ones (rows are preserved); duplicate transfer leg references keep the
-- earliest transfers row's link and clear later ones.

UPDATE transactions
SET offline_id = NULL
WHERE offline_id IS NOT NULL
  AND rowid NOT IN (
    SELECT MIN(rowid)
    FROM transactions
    WHERE offline_id IS NOT NULL
    GROUP BY household_id, offline_id
  );--> statement-breakpoint

UPDATE transfers
SET from_transaction_id = NULL
WHERE from_transaction_id IS NOT NULL
  AND rowid NOT IN (
    SELECT MIN(rowid)
    FROM transfers
    WHERE from_transaction_id IS NOT NULL
    GROUP BY from_transaction_id
  );--> statement-breakpoint

UPDATE transfers
SET to_transaction_id = NULL
WHERE to_transaction_id IS NOT NULL
  AND rowid NOT IN (
    SELECT MIN(rowid)
    FROM transfers
    WHERE to_transaction_id IS NOT NULL
    GROUP BY to_transaction_id
  );--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_household_offline_unique
  ON transactions (household_id, offline_id)
  WHERE offline_id IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_from_transaction_unique
  ON transfers (from_transaction_id)
  WHERE from_transaction_id IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_to_transaction_unique
  ON transfers (to_transaction_id)
  WHERE to_transaction_id IS NOT NULL;
