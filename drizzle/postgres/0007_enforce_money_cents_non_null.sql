UPDATE accounts
SET current_balance_cents = COALESCE(
  current_balance_cents,
  ROUND(COALESCE(current_balance, 0)::numeric * 100)::bigint
)
WHERE current_balance_cents IS NULL;--> statement-breakpoint

UPDATE transactions
SET amount_cents = COALESCE(
  amount_cents,
  ROUND(amount::numeric * 100)::bigint
)
WHERE amount_cents IS NULL;--> statement-breakpoint

UPDATE transaction_splits
SET amount_cents = COALESCE(
  amount_cents,
  ROUND(amount::numeric * 100)::bigint
)
WHERE amount_cents IS NULL;--> statement-breakpoint

UPDATE transfers
SET
  amount_cents = COALESCE(
    amount_cents,
    ROUND(amount::numeric * 100)::bigint
  ),
  fees_cents = COALESCE(
    fees_cents,
    ROUND(COALESCE(fees, 0)::numeric * 100)::bigint
  )
WHERE amount_cents IS NULL
   OR fees_cents IS NULL;--> statement-breakpoint

ALTER TABLE accounts ALTER COLUMN current_balance_cents SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE accounts ALTER COLUMN current_balance_cents SET NOT NULL;--> statement-breakpoint

ALTER TABLE transactions ALTER COLUMN amount_cents SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE transactions ALTER COLUMN amount_cents SET NOT NULL;--> statement-breakpoint

ALTER TABLE transaction_splits ALTER COLUMN amount_cents SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE transaction_splits ALTER COLUMN amount_cents SET NOT NULL;--> statement-breakpoint

ALTER TABLE transfers ALTER COLUMN amount_cents SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE transfers ALTER COLUMN amount_cents SET NOT NULL;--> statement-breakpoint
ALTER TABLE transfers ALTER COLUMN fees_cents SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE transfers ALTER COLUMN fees_cents SET NOT NULL;--> statement-breakpoint

CREATE OR REPLACE FUNCTION sync_accounts_money_cents() RETURNS trigger AS $$
BEGIN
  NEW.current_balance_cents := ROUND(COALESCE(NEW.current_balance, 0)::numeric * 100)::bigint;
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

CREATE OR REPLACE FUNCTION sync_transfers_amount_cents() RETURNS trigger AS $$
BEGIN
  NEW.amount_cents := ROUND(COALESCE(NEW.amount, 0)::numeric * 100)::bigint;
  NEW.fees_cents := ROUND(COALESCE(NEW.fees, 0)::numeric * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
