UPDATE accounts
SET
  current_balance_cents = COALESCE(
    current_balance_cents,
    CAST(ROUND(COALESCE(current_balance, 0) * 100) AS INTEGER)
  ),
  available_balance_cents = CASE
    WHEN available_balance IS NULL THEN NULL
    ELSE CAST(ROUND(available_balance * 100) AS INTEGER)
  END,
  credit_limit_cents = CASE
    WHEN credit_limit IS NULL THEN NULL
    ELSE CAST(ROUND(credit_limit * 100) AS INTEGER)
  END;--> statement-breakpoint

UPDATE transactions
SET amount_cents = COALESCE(
  amount_cents,
  CAST(ROUND(amount * 100) AS INTEGER)
);--> statement-breakpoint

UPDATE transaction_splits
SET amount_cents = COALESCE(
  amount_cents,
  CAST(ROUND(amount * 100) AS INTEGER)
);--> statement-breakpoint

UPDATE transfers
SET
  amount_cents = COALESCE(
    amount_cents,
    CAST(ROUND(amount * 100) AS INTEGER)
  ),
  fees_cents = COALESCE(
    fees_cents,
    CAST(ROUND(COALESCE(fees, 0) * 100) AS INTEGER)
  );--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounts_money_cents_guard_insert;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_accounts_money_cents_guard_update;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_transactions_money_cents_guard_insert;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_transactions_money_cents_guard_update;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_transaction_splits_money_cents_guard_insert;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_transaction_splits_money_cents_guard_update;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_transfers_money_cents_guard_insert;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_transfers_money_cents_guard_update;--> statement-breakpoint

CREATE TRIGGER trg_accounts_money_cents_guard_insert
AFTER INSERT ON accounts
BEGIN
  SELECT CASE
    WHEN (
      a.current_balance_cents IS NULL
      OR ABS(COALESCE(a.current_balance, 0) - (a.current_balance_cents / 100.0)) > 0.000001
      OR NOT (
        (a.available_balance IS NULL AND a.available_balance_cents IS NULL)
        OR (
          a.available_balance IS NOT NULL
          AND a.available_balance_cents IS NOT NULL
          AND ABS(a.available_balance - (a.available_balance_cents / 100.0)) <= 0.000001
        )
      )
      OR NOT (
        (a.credit_limit IS NULL AND a.credit_limit_cents IS NULL)
        OR (
          a.credit_limit IS NOT NULL
          AND a.credit_limit_cents IS NOT NULL
          AND ABS(a.credit_limit - (a.credit_limit_cents / 100.0)) <= 0.000001
        )
      )
    )
    THEN RAISE(ABORT, 'accounts money cents integrity check failed')
  END
  FROM accounts a
  WHERE a.id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_accounts_money_cents_guard_update
AFTER UPDATE OF current_balance_cents, available_balance_cents, credit_limit_cents ON accounts
BEGIN
  SELECT CASE
    WHEN (
      a.current_balance_cents IS NULL
      OR ABS(COALESCE(a.current_balance, 0) - (a.current_balance_cents / 100.0)) > 0.000001
      OR NOT (
        (a.available_balance IS NULL AND a.available_balance_cents IS NULL)
        OR (
          a.available_balance IS NOT NULL
          AND a.available_balance_cents IS NOT NULL
          AND ABS(a.available_balance - (a.available_balance_cents / 100.0)) <= 0.000001
        )
      )
      OR NOT (
        (a.credit_limit IS NULL AND a.credit_limit_cents IS NULL)
        OR (
          a.credit_limit IS NOT NULL
          AND a.credit_limit_cents IS NOT NULL
          AND ABS(a.credit_limit - (a.credit_limit_cents / 100.0)) <= 0.000001
        )
      )
    )
    THEN RAISE(ABORT, 'accounts money cents integrity check failed')
  END
  FROM accounts a
  WHERE a.id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_transactions_money_cents_guard_insert
AFTER INSERT ON transactions
BEGIN
  SELECT CASE
    WHEN (
      t.amount_cents IS NULL
      OR ABS(t.amount - (t.amount_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transactions money cents integrity check failed')
  END
  FROM transactions t
  WHERE t.id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_transactions_money_cents_guard_update
AFTER UPDATE OF amount_cents ON transactions
BEGIN
  SELECT CASE
    WHEN (
      t.amount_cents IS NULL
      OR ABS(t.amount - (t.amount_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transactions money cents integrity check failed')
  END
  FROM transactions t
  WHERE t.id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_transaction_splits_money_cents_guard_insert
AFTER INSERT ON transaction_splits
BEGIN
  SELECT CASE
    WHEN (
      ts.amount_cents IS NULL
      OR ABS(ts.amount - (ts.amount_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transaction_splits money cents integrity check failed')
  END
  FROM transaction_splits ts
  WHERE ts.id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_transaction_splits_money_cents_guard_update
AFTER UPDATE OF amount_cents ON transaction_splits
BEGIN
  SELECT CASE
    WHEN (
      ts.amount_cents IS NULL
      OR ABS(ts.amount - (ts.amount_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transaction_splits money cents integrity check failed')
  END
  FROM transaction_splits ts
  WHERE ts.id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_transfers_money_cents_guard_insert
AFTER INSERT ON transfers
BEGIN
  SELECT CASE
    WHEN (
      tr.amount_cents IS NULL
      OR tr.fees_cents IS NULL
      OR ABS(tr.amount - (tr.amount_cents / 100.0)) > 0.000001
      OR ABS(COALESCE(tr.fees, 0) - (tr.fees_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transfers money cents integrity check failed')
  END
  FROM transfers tr
  WHERE tr.id = NEW.id;
END;--> statement-breakpoint

CREATE TRIGGER trg_transfers_money_cents_guard_update
AFTER UPDATE OF amount_cents, fees_cents ON transfers
BEGIN
  SELECT CASE
    WHEN (
      tr.amount_cents IS NULL
      OR tr.fees_cents IS NULL
      OR ABS(tr.amount - (tr.amount_cents / 100.0)) > 0.000001
      OR ABS(COALESCE(tr.fees, 0) - (tr.fees_cents / 100.0)) > 0.000001
    )
    THEN RAISE(ABORT, 'transfers money cents integrity check failed')
  END
  FROM transfers tr
  WHERE tr.id = NEW.id;
END;
