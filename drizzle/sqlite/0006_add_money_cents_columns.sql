ALTER TABLE accounts ADD COLUMN current_balance_cents INTEGER;--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN available_balance_cents INTEGER;--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN credit_limit_cents INTEGER;--> statement-breakpoint

ALTER TABLE transactions ADD COLUMN amount_cents INTEGER;--> statement-breakpoint
ALTER TABLE transaction_splits ADD COLUMN amount_cents INTEGER;--> statement-breakpoint
ALTER TABLE transfers ADD COLUMN amount_cents INTEGER;--> statement-breakpoint
ALTER TABLE transfers ADD COLUMN fees_cents INTEGER;--> statement-breakpoint

UPDATE accounts
SET
  current_balance_cents = CASE
    WHEN current_balance IS NULL THEN NULL
    ELSE CAST(ROUND(current_balance * 100) AS INTEGER)
  END,
  available_balance_cents = CASE
    WHEN available_balance IS NULL THEN NULL
    ELSE CAST(ROUND(available_balance * 100) AS INTEGER)
  END,
  credit_limit_cents = CASE
    WHEN credit_limit IS NULL THEN NULL
    ELSE CAST(ROUND(credit_limit * 100) AS INTEGER)
  END
WHERE current_balance_cents IS NULL
   OR available_balance_cents IS NULL
   OR credit_limit_cents IS NULL;--> statement-breakpoint

UPDATE transactions
SET amount_cents = CASE
  WHEN amount IS NULL THEN NULL
  ELSE CAST(ROUND(amount * 100) AS INTEGER)
END
WHERE amount_cents IS NULL;--> statement-breakpoint

UPDATE transaction_splits
SET amount_cents = CASE
  WHEN amount IS NULL THEN NULL
  ELSE CAST(ROUND(amount * 100) AS INTEGER)
END
WHERE amount_cents IS NULL;--> statement-breakpoint

UPDATE transfers
SET
  amount_cents = CASE
    WHEN amount IS NULL THEN NULL
    ELSE CAST(ROUND(amount * 100) AS INTEGER)
  END,
  fees_cents = CASE
    WHEN fees IS NULL THEN NULL
    ELSE CAST(ROUND(fees * 100) AS INTEGER)
  END
WHERE amount_cents IS NULL
   OR fees_cents IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_accounts_current_balance_cents ON accounts(current_balance_cents);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_amount_cents ON transactions(amount_cents);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transaction_splits_amount_cents ON transaction_splits(amount_cents);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_amount_cents ON transfers(amount_cents);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_fees_cents ON transfers(fees_cents);--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_accounts_sync_money_cents_insert
AFTER INSERT ON accounts
BEGIN
  UPDATE accounts
  SET
    current_balance_cents = CASE
      WHEN NEW.current_balance IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.current_balance * 100) AS INTEGER)
    END,
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

CREATE TRIGGER IF NOT EXISTS trg_accounts_sync_money_cents_update
AFTER UPDATE OF current_balance, available_balance, credit_limit ON accounts
BEGIN
  UPDATE accounts
  SET
    current_balance_cents = CASE
      WHEN NEW.current_balance IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.current_balance * 100) AS INTEGER)
    END,
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

CREATE TRIGGER IF NOT EXISTS trg_transactions_sync_amount_cents_insert
AFTER INSERT ON transactions
BEGIN
  UPDATE transactions
  SET amount_cents = CASE
    WHEN NEW.amount IS NULL THEN NULL
    ELSE CAST(ROUND(NEW.amount * 100) AS INTEGER)
  END
  WHERE id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_transactions_sync_amount_cents_update
AFTER UPDATE OF amount ON transactions
BEGIN
  UPDATE transactions
  SET amount_cents = CASE
    WHEN NEW.amount IS NULL THEN NULL
    ELSE CAST(ROUND(NEW.amount * 100) AS INTEGER)
  END
  WHERE id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_transaction_splits_sync_amount_cents_insert
AFTER INSERT ON transaction_splits
BEGIN
  UPDATE transaction_splits
  SET amount_cents = CASE
    WHEN NEW.amount IS NULL THEN NULL
    ELSE CAST(ROUND(NEW.amount * 100) AS INTEGER)
  END
  WHERE id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_transaction_splits_sync_amount_cents_update
AFTER UPDATE OF amount ON transaction_splits
BEGIN
  UPDATE transaction_splits
  SET amount_cents = CASE
    WHEN NEW.amount IS NULL THEN NULL
    ELSE CAST(ROUND(NEW.amount * 100) AS INTEGER)
  END
  WHERE id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_transfers_sync_amount_cents_insert
AFTER INSERT ON transfers
BEGIN
  UPDATE transfers
  SET
    amount_cents = CASE
      WHEN NEW.amount IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.amount * 100) AS INTEGER)
    END,
    fees_cents = CASE
      WHEN NEW.fees IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.fees * 100) AS INTEGER)
    END
  WHERE id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_transfers_sync_amount_cents_update
AFTER UPDATE OF amount, fees ON transfers
BEGIN
  UPDATE transfers
  SET
    amount_cents = CASE
      WHEN NEW.amount IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.amount * 100) AS INTEGER)
    END,
    fees_cents = CASE
      WHEN NEW.fees IS NULL THEN NULL
      ELSE CAST(ROUND(NEW.fees * 100) AS INTEGER)
    END
  WHERE id = NEW.id;
END;
