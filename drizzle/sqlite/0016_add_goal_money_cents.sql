-- RC-4: integer-cents columns for savings goals and their contribution ledger.
-- Cents is the source of truth in code; the float columns are derived (= cents/100).
-- Data-preserving: ADD COLUMN + backfill only. No float->cents triggers.

ALTER TABLE savings_goals ADD COLUMN current_amount_cents INTEGER;--> statement-breakpoint
ALTER TABLE savings_goals ADD COLUMN target_amount_cents INTEGER;--> statement-breakpoint

ALTER TABLE savings_goal_contributions ADD COLUMN amount_cents INTEGER;--> statement-breakpoint

UPDATE savings_goals
SET
  current_amount_cents = CAST(ROUND(COALESCE(current_amount, 0) * 100) AS INTEGER),
  target_amount_cents = CAST(ROUND(target_amount * 100) AS INTEGER)
WHERE current_amount_cents IS NULL;--> statement-breakpoint

UPDATE savings_goal_contributions
SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER)
WHERE amount_cents IS NULL;
