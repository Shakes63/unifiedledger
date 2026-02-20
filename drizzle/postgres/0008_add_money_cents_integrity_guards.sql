UPDATE accounts
SET
  current_balance_cents = COALESCE(
    current_balance_cents,
    ROUND(COALESCE(current_balance, 0)::numeric * 100)::bigint
  ),
  available_balance_cents = CASE
    WHEN available_balance IS NULL THEN NULL
    ELSE ROUND(available_balance::numeric * 100)::bigint
  END,
  credit_limit_cents = CASE
    WHEN credit_limit IS NULL THEN NULL
    ELSE ROUND(credit_limit::numeric * 100)::bigint
  END;--> statement-breakpoint

UPDATE transactions
SET amount_cents = COALESCE(
  amount_cents,
  ROUND(amount::numeric * 100)::bigint
);--> statement-breakpoint

UPDATE transaction_splits
SET amount_cents = COALESCE(
  amount_cents,
  ROUND(amount::numeric * 100)::bigint
);--> statement-breakpoint

UPDATE transfers
SET
  amount_cents = COALESCE(
    amount_cents,
    ROUND(amount::numeric * 100)::bigint
  ),
  fees_cents = COALESCE(
    fees_cents,
    ROUND(COALESCE(fees, 0)::numeric * 100)::bigint
  );--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_money_cents_consistent_chk'
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_money_cents_consistent_chk
      CHECK (
        current_balance_cents IS NOT NULL
        AND current_balance_cents = ROUND(COALESCE(current_balance, 0)::numeric * 100)::bigint
        AND (
          (available_balance IS NULL AND available_balance_cents IS NULL)
          OR (
            available_balance IS NOT NULL
            AND available_balance_cents = ROUND(available_balance::numeric * 100)::bigint
          )
        )
        AND (
          (credit_limit IS NULL AND credit_limit_cents IS NULL)
          OR (
            credit_limit IS NOT NULL
            AND credit_limit_cents = ROUND(credit_limit::numeric * 100)::bigint
          )
        )
      ) NOT VALID;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_money_cents_consistent_chk'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_money_cents_consistent_chk
      CHECK (
        amount_cents IS NOT NULL
        AND amount_cents = ROUND(amount::numeric * 100)::bigint
      ) NOT VALID;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transaction_splits_money_cents_consistent_chk'
  ) THEN
    ALTER TABLE transaction_splits
      ADD CONSTRAINT transaction_splits_money_cents_consistent_chk
      CHECK (
        amount_cents IS NOT NULL
        AND amount_cents = ROUND(amount::numeric * 100)::bigint
      ) NOT VALID;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transfers_money_cents_consistent_chk'
  ) THEN
    ALTER TABLE transfers
      ADD CONSTRAINT transfers_money_cents_consistent_chk
      CHECK (
        amount_cents IS NOT NULL
        AND fees_cents IS NOT NULL
        AND amount_cents = ROUND(amount::numeric * 100)::bigint
        AND fees_cents = ROUND(COALESCE(fees, 0)::numeric * 100)::bigint
      ) NOT VALID;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_money_cents_consistent_chk'
      AND convalidated = false
  ) THEN
    ALTER TABLE accounts VALIDATE CONSTRAINT accounts_money_cents_consistent_chk;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_money_cents_consistent_chk'
      AND convalidated = false
  ) THEN
    ALTER TABLE transactions VALIDATE CONSTRAINT transactions_money_cents_consistent_chk;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transaction_splits_money_cents_consistent_chk'
      AND convalidated = false
  ) THEN
    ALTER TABLE transaction_splits VALIDATE CONSTRAINT transaction_splits_money_cents_consistent_chk;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transfers_money_cents_consistent_chk'
      AND convalidated = false
  ) THEN
    ALTER TABLE transfers VALIDATE CONSTRAINT transfers_money_cents_consistent_chk;
  END IF;
END $$;
