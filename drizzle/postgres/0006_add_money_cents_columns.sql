ALTER TABLE accounts ADD COLUMN IF NOT EXISTS current_balance_cents BIGINT;--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS available_balance_cents BIGINT;--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credit_limit_cents BIGINT;--> statement-breakpoint

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_cents BIGINT;--> statement-breakpoint
ALTER TABLE transaction_splits ADD COLUMN IF NOT EXISTS amount_cents BIGINT;--> statement-breakpoint
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS amount_cents BIGINT;--> statement-breakpoint
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS fees_cents BIGINT;--> statement-breakpoint

UPDATE accounts
SET
  current_balance_cents = CASE
    WHEN current_balance IS NULL THEN NULL
    ELSE ROUND(current_balance::numeric * 100)::bigint
  END,
  available_balance_cents = CASE
    WHEN available_balance IS NULL THEN NULL
    ELSE ROUND(available_balance::numeric * 100)::bigint
  END,
  credit_limit_cents = CASE
    WHEN credit_limit IS NULL THEN NULL
    ELSE ROUND(credit_limit::numeric * 100)::bigint
  END
WHERE current_balance_cents IS NULL
   OR available_balance_cents IS NULL
   OR credit_limit_cents IS NULL;--> statement-breakpoint

UPDATE transactions
SET amount_cents = CASE
  WHEN amount IS NULL THEN NULL
  ELSE ROUND(amount::numeric * 100)::bigint
END
WHERE amount_cents IS NULL;--> statement-breakpoint

UPDATE transaction_splits
SET amount_cents = CASE
  WHEN amount IS NULL THEN NULL
  ELSE ROUND(amount::numeric * 100)::bigint
END
WHERE amount_cents IS NULL;--> statement-breakpoint

UPDATE transfers
SET
  amount_cents = CASE
    WHEN amount IS NULL THEN NULL
    ELSE ROUND(amount::numeric * 100)::bigint
  END,
  fees_cents = CASE
    WHEN fees IS NULL THEN NULL
    ELSE ROUND(fees::numeric * 100)::bigint
  END
WHERE amount_cents IS NULL
   OR fees_cents IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_accounts_current_balance_cents ON accounts(current_balance_cents);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transactions_amount_cents ON transactions(amount_cents);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transaction_splits_amount_cents ON transaction_splits(amount_cents);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_amount_cents ON transfers(amount_cents);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_transfers_fees_cents ON transfers(fees_cents);--> statement-breakpoint

CREATE OR REPLACE FUNCTION sync_accounts_money_cents() RETURNS trigger AS $$
BEGIN
  NEW.current_balance_cents := CASE
    WHEN NEW.current_balance IS NULL THEN NULL
    ELSE ROUND(NEW.current_balance::numeric * 100)::bigint
  END;
  NEW.available_balance_cents := CASE
    WHEN NEW.available_balance IS NULL THEN NULL
    ELSE ROUND(NEW.available_balance::numeric * 100)::bigint
  END;
  NEW.credit_limit_cents := CASE
    WHEN NEW.credit_limit IS NULL THEN NULL
    ELSE ROUND(NEW.credit_limit::numeric * 100)::bigint
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounts_sync_money_cents ON accounts;--> statement-breakpoint
CREATE TRIGGER trg_accounts_sync_money_cents
BEFORE INSERT OR UPDATE OF current_balance, available_balance, credit_limit ON accounts
FOR EACH ROW
EXECUTE FUNCTION sync_accounts_money_cents();--> statement-breakpoint

CREATE OR REPLACE FUNCTION sync_transactions_amount_cents() RETURNS trigger AS $$
BEGIN
  NEW.amount_cents := CASE
    WHEN NEW.amount IS NULL THEN NULL
    ELSE ROUND(NEW.amount::numeric * 100)::bigint
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_transactions_sync_amount_cents ON transactions;--> statement-breakpoint
CREATE TRIGGER trg_transactions_sync_amount_cents
BEFORE INSERT OR UPDATE OF amount ON transactions
FOR EACH ROW
EXECUTE FUNCTION sync_transactions_amount_cents();--> statement-breakpoint

CREATE OR REPLACE FUNCTION sync_transaction_splits_amount_cents() RETURNS trigger AS $$
BEGIN
  NEW.amount_cents := CASE
    WHEN NEW.amount IS NULL THEN NULL
    ELSE ROUND(NEW.amount::numeric * 100)::bigint
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_transaction_splits_sync_amount_cents ON transaction_splits;--> statement-breakpoint
CREATE TRIGGER trg_transaction_splits_sync_amount_cents
BEFORE INSERT OR UPDATE OF amount ON transaction_splits
FOR EACH ROW
EXECUTE FUNCTION sync_transaction_splits_amount_cents();--> statement-breakpoint

CREATE OR REPLACE FUNCTION sync_transfers_amount_cents() RETURNS trigger AS $$
BEGIN
  NEW.amount_cents := CASE
    WHEN NEW.amount IS NULL THEN NULL
    ELSE ROUND(NEW.amount::numeric * 100)::bigint
  END;
  NEW.fees_cents := CASE
    WHEN NEW.fees IS NULL THEN NULL
    ELSE ROUND(NEW.fees::numeric * 100)::bigint
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_transfers_sync_amount_cents ON transfers;--> statement-breakpoint
CREATE TRIGGER trg_transfers_sync_amount_cents
BEFORE INSERT OR UPDATE OF amount, fees ON transfers
FOR EACH ROW
EXECUTE FUNCTION sync_transfers_amount_cents();
