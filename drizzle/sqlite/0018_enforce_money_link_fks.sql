-- C-DB-2: enforce the money-link foreign keys at the database level.
--
-- Until now NO foreign keys existed; a deleted parent could leave dangling
-- children/refs that only the reversal layer + cleanup job caught. This makes
-- the relationships structural. SQLite cannot ALTER TABLE ADD CONSTRAINT, so
-- each CHILD table is rebuilt (create -> copy -> drop -> rename) with the FK
-- baked in. Parent tables (transactions, debts, savings_goals, bill_occurrences)
-- are never touched.
--
-- FK actions mirror lib/cleanup/data-cleanup.ts exactly:
--   CASCADE  — child is meaningless without its parent (splits, tags, custom
--              field values, debt_payments->debts, contributions->goals,
--              bill_payment_events->occurrences).
--   SET NULL — the record is still valid; only the dangling reference clears
--              (debt_payments.transaction_id, transfers.from/to_transaction_id).
--
-- Orphan-cleanup runs FIRST (idempotent; a no-op on a clean DB) so the rebuild
-- never carries a row that would violate its own new constraint. The money-cents
-- sync/guard triggers on transaction_splits and transfers are recreated verbatim
-- after the swap. Column order and defaults reproduce the live schema; INSERT
-- uses explicit column lists so the copy can never mis-map.
-- ---- Orphan cleanup (safety net for legacy/other DBs; no-op when clean) ----
DELETE FROM transaction_splits WHERE transaction_id NOT IN (SELECT id FROM transactions);--> statement-breakpoint
DELETE FROM transaction_tags WHERE transaction_id NOT IN (SELECT id FROM transactions);--> statement-breakpoint
DELETE FROM custom_field_values WHERE transaction_id NOT IN (SELECT id FROM transactions);--> statement-breakpoint
DELETE FROM debt_payments WHERE debt_id NOT IN (SELECT id FROM debts);--> statement-breakpoint
DELETE FROM savings_goal_contributions WHERE goal_id NOT IN (SELECT id FROM savings_goals);--> statement-breakpoint
DELETE FROM bill_payment_events WHERE occurrence_id NOT IN (SELECT id FROM bill_occurrences);--> statement-breakpoint
UPDATE debt_payments SET transaction_id = NULL WHERE transaction_id IS NOT NULL AND transaction_id NOT IN (SELECT id FROM transactions);--> statement-breakpoint
UPDATE transfers SET from_transaction_id = NULL WHERE from_transaction_id IS NOT NULL AND from_transaction_id NOT IN (SELECT id FROM transactions);--> statement-breakpoint
UPDATE transfers SET to_transaction_id = NULL WHERE to_transaction_id IS NOT NULL AND to_transaction_id NOT IN (SELECT id FROM transactions);--> statement-breakpoint

-- ============================ transaction_splits ============================
CREATE TABLE `__new_transaction_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`category_id` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`percentage` real,
	`is_percentage` integer DEFAULT false,
	`sort_order` integer DEFAULT 0,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`amount_cents` integer,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
);--> statement-breakpoint
INSERT INTO `__new_transaction_splits` (`id`,`user_id`,`household_id`,`transaction_id`,`category_id`,`amount`,`description`,`percentage`,`is_percentage`,`sort_order`,`notes`,`created_at`,`updated_at`,`amount_cents`)
SELECT `id`,`user_id`,`household_id`,`transaction_id`,`category_id`,`amount`,`description`,`percentage`,`is_percentage`,`sort_order`,`notes`,`created_at`,`updated_at`,`amount_cents` FROM `transaction_splits`;--> statement-breakpoint
DROP TABLE `transaction_splits`;--> statement-breakpoint
ALTER TABLE `__new_transaction_splits` RENAME TO `transaction_splits`;--> statement-breakpoint
CREATE INDEX `idx_transaction_splits` ON `transaction_splits` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user` ON `transaction_splits` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_household` ON `transaction_splits` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user_household` ON `transaction_splits` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_category` ON `transaction_splits` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_user_tx` ON `transaction_splits` (`user_id`,`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_splits_amount_cents` ON `transaction_splits` (`amount_cents`);--> statement-breakpoint
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

-- ============================ transaction_tags ============================
CREATE TABLE `__new_transaction_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
);--> statement-breakpoint
INSERT INTO `__new_transaction_tags` (`id`,`user_id`,`transaction_id`,`tag_id`,`created_at`)
SELECT `id`,`user_id`,`transaction_id`,`tag_id`,`created_at` FROM `transaction_tags`;--> statement-breakpoint
DROP TABLE `transaction_tags`;--> statement-breakpoint
ALTER TABLE `__new_transaction_tags` RENAME TO `transaction_tags`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transaction_tags_unique` ON `transaction_tags` (`transaction_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_user` ON `transaction_tags` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_transaction` ON `transaction_tags` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_tags_tag` ON `transaction_tags` (`tag_id`);--> statement-breakpoint

-- ============================ custom_field_values ============================
CREATE TABLE `__new_custom_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`custom_field_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`value` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
);--> statement-breakpoint
INSERT INTO `__new_custom_field_values` (`id`,`user_id`,`custom_field_id`,`transaction_id`,`value`,`created_at`,`updated_at`)
SELECT `id`,`user_id`,`custom_field_id`,`transaction_id`,`value`,`created_at`,`updated_at` FROM `custom_field_values`;--> statement-breakpoint
DROP TABLE `custom_field_values`;--> statement-breakpoint
ALTER TABLE `__new_custom_field_values` RENAME TO `custom_field_values`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_custom_field_values_unique` ON `custom_field_values` (`custom_field_id`,`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_custom_field_values_user` ON `custom_field_values` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_custom_field_values_field` ON `custom_field_values` (`custom_field_id`);--> statement-breakpoint
CREATE INDEX `idx_custom_field_values_transaction` ON `custom_field_values` (`transaction_id`);--> statement-breakpoint

-- ============================ debt_payments ============================
CREATE TABLE `__new_debt_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`amount` real NOT NULL,
	`principal_amount` real DEFAULT 0,
	`interest_amount` real DEFAULT 0,
	`payment_date` text NOT NULL,
	`transaction_id` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`amount_cents` integer,
	`principal_cents` integer,
	`interest_cents` integer,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL
);--> statement-breakpoint
INSERT INTO `__new_debt_payments` (`id`,`debt_id`,`user_id`,`household_id`,`amount`,`principal_amount`,`interest_amount`,`payment_date`,`transaction_id`,`notes`,`created_at`,`amount_cents`,`principal_cents`,`interest_cents`)
SELECT `id`,`debt_id`,`user_id`,`household_id`,`amount`,`principal_amount`,`interest_amount`,`payment_date`,`transaction_id`,`notes`,`created_at`,`amount_cents`,`principal_cents`,`interest_cents` FROM `debt_payments`;--> statement-breakpoint
DROP TABLE `debt_payments`;--> statement-breakpoint
ALTER TABLE `__new_debt_payments` RENAME TO `debt_payments`;--> statement-breakpoint
CREATE INDEX `idx_debt_payments_user` ON `debt_payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payments_household` ON `debt_payments` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payments_user_household` ON `debt_payments` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_debt_payments_debt` ON `debt_payments` (`debt_id`);--> statement-breakpoint

-- ======================= savings_goal_contributions =======================
CREATE TABLE `__new_savings_goal_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`amount_cents` integer,
	FOREIGN KEY (`goal_id`) REFERENCES `savings_goals`(`id`) ON DELETE CASCADE
);--> statement-breakpoint
INSERT INTO `__new_savings_goal_contributions` (`id`,`transaction_id`,`goal_id`,`user_id`,`household_id`,`amount`,`created_at`,`amount_cents`)
SELECT `id`,`transaction_id`,`goal_id`,`user_id`,`household_id`,`amount`,`created_at`,`amount_cents` FROM `savings_goal_contributions`;--> statement-breakpoint
DROP TABLE `savings_goal_contributions`;--> statement-breakpoint
ALTER TABLE `__new_savings_goal_contributions` RENAME TO `savings_goal_contributions`;--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_transaction` ON `savings_goal_contributions` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_goal` ON `savings_goal_contributions` (`goal_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_user_household` ON `savings_goal_contributions` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_goal_created` ON `savings_goal_contributions` (`goal_id`,`created_at`);--> statement-breakpoint

-- ============================ bill_payment_events ============================
CREATE TABLE `__new_bill_payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`template_id` text NOT NULL,
	`occurrence_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`principal_cents` integer,
	`interest_cents` integer,
	`balance_before_cents` integer,
	`balance_after_cents` integer,
	`payment_date` text NOT NULL,
	`payment_method` text NOT NULL DEFAULT 'manual',
	`source_account_id` text,
	`idempotency_key` text,
	`notes` text,
	`created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`occurrence_id`) REFERENCES `bill_occurrences`(`id`) ON DELETE CASCADE
);--> statement-breakpoint
INSERT INTO `__new_bill_payment_events` (`id`,`household_id`,`template_id`,`occurrence_id`,`transaction_id`,`amount_cents`,`principal_cents`,`interest_cents`,`balance_before_cents`,`balance_after_cents`,`payment_date`,`payment_method`,`source_account_id`,`idempotency_key`,`notes`,`created_at`)
SELECT `id`,`household_id`,`template_id`,`occurrence_id`,`transaction_id`,`amount_cents`,`principal_cents`,`interest_cents`,`balance_before_cents`,`balance_after_cents`,`payment_date`,`payment_method`,`source_account_id`,`idempotency_key`,`notes`,`created_at` FROM `bill_payment_events`;--> statement-breakpoint
DROP TABLE `bill_payment_events`;--> statement-breakpoint
ALTER TABLE `__new_bill_payment_events` RENAME TO `bill_payment_events`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bill_payment_events_idempotency` ON `bill_payment_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_bill_payment_events_household_date` ON `bill_payment_events` (`household_id`,`payment_date`);--> statement-breakpoint
CREATE INDEX `idx_bill_payment_events_occurrence` ON `bill_payment_events` (`occurrence_id`);--> statement-breakpoint

-- ================================ transfers ================================
CREATE TABLE `__new_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_account_id` text NOT NULL,
	`to_account_id` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`date` text NOT NULL,
	`status` text DEFAULT 'completed',
	`from_transaction_id` text,
	`to_transaction_id` text,
	`fees` real DEFAULT 0,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`household_id` text,
	`amount_cents` integer,
	`fees_cents` integer,
	FOREIGN KEY (`from_transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL,
	FOREIGN KEY (`to_transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL
);--> statement-breakpoint
INSERT INTO `__new_transfers` (`id`,`user_id`,`from_account_id`,`to_account_id`,`amount`,`description`,`date`,`status`,`from_transaction_id`,`to_transaction_id`,`fees`,`notes`,`created_at`,`household_id`,`amount_cents`,`fees_cents`)
SELECT `id`,`user_id`,`from_account_id`,`to_account_id`,`amount`,`description`,`date`,`status`,`from_transaction_id`,`to_transaction_id`,`fees`,`notes`,`created_at`,`household_id`,`amount_cents`,`fees_cents` FROM `transfers`;--> statement-breakpoint
DROP TABLE `transfers`;--> statement-breakpoint
ALTER TABLE `__new_transfers` RENAME TO `transfers`;--> statement-breakpoint
CREATE INDEX `idx_transfers_user` ON `transfers` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transfers_household` ON `transfers` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transfers_user_household` ON `transfers` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_transfers_amount_cents` ON `transfers` (`amount_cents`);--> statement-breakpoint
CREATE INDEX `idx_transfers_fees_cents` ON `transfers` (`fees_cents`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transfers_from_transaction_unique` ON `transfers` (`from_transaction_id`) WHERE `from_transaction_id` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transfers_to_transaction_unique` ON `transfers` (`to_transaction_id`) WHERE `to_transaction_id` IS NOT NULL;--> statement-breakpoint
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
