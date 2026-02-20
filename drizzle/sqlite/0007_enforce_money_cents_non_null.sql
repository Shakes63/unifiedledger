UPDATE accounts
SET current_balance_cents = COALESCE(
  current_balance_cents,
  CAST(ROUND(COALESCE(current_balance, 0) * 100) AS INTEGER)
)
WHERE current_balance_cents IS NULL;--> statement-breakpoint

UPDATE transactions
SET amount_cents = COALESCE(
  amount_cents,
  CAST(ROUND(amount * 100) AS INTEGER)
)
WHERE amount_cents IS NULL;--> statement-breakpoint

UPDATE transaction_splits
SET amount_cents = COALESCE(
  amount_cents,
  CAST(ROUND(amount * 100) AS INTEGER)
)
WHERE amount_cents IS NULL;--> statement-breakpoint

UPDATE transfers
SET
  amount_cents = COALESCE(
    amount_cents,
    CAST(ROUND(amount * 100) AS INTEGER)
  ),
  fees_cents = COALESCE(
    fees_cents,
    CAST(ROUND(COALESCE(fees, 0) * 100) AS INTEGER)
  )
WHERE amount_cents IS NULL
   OR fees_cents IS NULL;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounts_sync_money_cents_insert;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_accounts_sync_money_cents_update;--> statement-breakpoint

CREATE TRIGGER trg_accounts_sync_money_cents_insert
AFTER INSERT ON accounts
BEGIN
  UPDATE accounts
  SET
    current_balance_cents = CAST(ROUND(COALESCE(NEW.current_balance, 0) * 100) AS INTEGER),
    available_balance_cents = CASE
      WHEN NEW.available_balance IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.available_balance * 100) AS INTEGER)
    END,
    credit_limit_cents = CASE
      WHEN NEW.credit_limit IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.credit_limit * 100) AS INTEGER)
    END
  WHERE id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_accounts_sync_money_cents_update
AFTER UPDATE OF current_balance, available_balance, credit_limit ON accounts
BEGIN
  UPDATE accounts
  SET
    current_balance_cents = CAST(ROUND(COALESCE(NEW.current_balance, 0) * 100) AS INTEGER),
    available_balance_cents = CASE
      WHEN NEW.available_balance IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.available_balance * 100) AS INTEGER)
    END,
    credit_limit_cents = CASE
      WHEN NEW.credit_limit IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.credit_limit * 100) AS INTEGER)
    END
  WHERE id = NEW.id;
END;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_transactions_sync_amount_cents_insert;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_transactions_sync_amount_cents_update;--> statement-breakpoint

CREATE TRIGGER trg_transactions_sync_amount_cents_insert
AFTER INSERT ON transactions
BEGIN
  UPDATE transactions
  SET amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_transactions_sync_amount_cents_update
AFTER UPDATE OF amount ON transactions
BEGIN
  UPDATE transactions
  SET amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_transaction_splits_sync_amount_cents_insert;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_transaction_splits_sync_amount_cents_update;--> statement-breakpoint

CREATE TRIGGER trg_transaction_splits_sync_amount_cents_insert
AFTER INSERT ON transaction_splits
BEGIN
  UPDATE transaction_splits
  SET amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_transaction_splits_sync_amount_cents_update
AFTER UPDATE OF amount ON transaction_splits
BEGIN
  UPDATE transaction_splits
  SET amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_transfers_sync_amount_cents_insert;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_transfers_sync_amount_cents_update;--> statement-breakpoint

CREATE TRIGGER trg_transfers_sync_amount_cents_insert
AFTER INSERT ON transfers
BEGIN
  UPDATE transfers
  SET
    amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER),
    fees_cents = CAST(ROUND(COALESCE(NEW.fees, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_transfers_sync_amount_cents_update
AFTER UPDATE OF amount, fees ON transfers
BEGIN
  UPDATE transfers
  SET
    amount_cents = CAST(ROUND(COALESCE(NEW.amount, 0) * 100) AS INTEGER),
    fees_cents = CAST(ROUND(COALESCE(NEW.fees, 0) * 100) AS INTEGER)
  WHERE id = NEW.id;
END;
