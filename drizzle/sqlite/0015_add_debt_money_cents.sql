-- RC-4 / H-DBG-10: add integer-cents columns for debt balances and payments.
-- Cents becomes the source of truth in code; the existing float columns are kept
-- as derived display values (= cents / 100). No float->cents triggers are added
-- (that inversion is what made accounts drift — H-DB-2). Data-preserving:
-- ADD COLUMN + backfill only, never dropping the float columns.

ALTER TABLE debts ADD COLUMN remaining_balance_cents INTEGER;--> statement-breakpoint

ALTER TABLE debt_payments ADD COLUMN amount_cents INTEGER;--> statement-breakpoint
ALTER TABLE debt_payments ADD COLUMN principal_cents INTEGER;--> statement-breakpoint
ALTER TABLE debt_payments ADD COLUMN interest_cents INTEGER;--> statement-breakpoint

UPDATE debts
SET remaining_balance_cents = CAST(ROUND(remaining_balance * 100) AS INTEGER)
WHERE remaining_balance_cents IS NULL;--> statement-breakpoint

UPDATE debt_payments
SET
  amount_cents = CAST(ROUND(amount * 100) AS INTEGER),
  principal_cents = CAST(ROUND(COALESCE(principal_amount, 0) * 100) AS INTEGER),
  interest_cents = CAST(ROUND(COALESCE(interest_amount, 0) * 100) AS INTEGER)
WHERE amount_cents IS NULL;
