-- Migration: Convert single 'transfer' transactions to 2-transaction model
-- This migration finds all transactions with type='transfer' and converts them to
-- a 2-transaction model with transfer_out and transfer_in

-- Step 1: For each existing transfer, create a transfer_in transaction for the destination account
INSERT INTO transactions (
  id,
  user_id,
  account_id,
  category_id,
  merchant_id,
  bill_id,
  date,
  amount,
  description,
  notes,
  type,
  transfer_id,
  is_pending,
  is_recurring,
  recurring_rule,
  receipt_url,
  is_split,
  split_parent_id,
  import_history_id,
  import_row_number,
  sync_status,
  offline_id,
  synced_at,
  sync_error,
  sync_attempts,
  created_at,
  updated_at
)
SELECT
  -- Generate new ID for the transfer_in transaction
  lower(hex(randomblob(16))),
  user_id,
  transfer_id, -- The destination account (currently stored in transfer_id)
  category_id,
  merchant_id,
  bill_id,
  date,
  amount,
  description,
  notes,
  'transfer_in', -- New transaction type
  id, -- Link back to the original transaction ID (will be the pair ID)
  is_pending,
  is_recurring,
  recurring_rule,
  receipt_url,
  is_split,
  split_parent_id,
  import_history_id,
  import_row_number,
  sync_status,
  offline_id,
  synced_at,
  sync_error,
  sync_attempts,
  created_at,
  updated_at
FROM transactions
WHERE type = 'transfer'
  AND transfer_id IS NOT NULL; -- Only process transfers with a destination account

-- Step 2: Update the original transactions to be transfer_out type
UPDATE transactions
SET
  type = 'transfer_out',
  updated_at = datetime('now')
WHERE type = 'transfer'
  AND transfer_id IS NOT NULL;

-- Step 3: For any transfer transactions without a destination account (shouldn't exist, but handle gracefully)
-- Convert them to regular expenses
UPDATE transactions
SET
  type = 'expense',
  updated_at = datetime('now')
WHERE type = 'transfer'
  AND transfer_id IS NULL;
