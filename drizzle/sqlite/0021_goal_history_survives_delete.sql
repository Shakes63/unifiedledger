-- Savings-goal lifecycle fixes (bug-hunt findings A7, A8, A12, A18, A2).
--
-- 1. savings_goal_contributions.goal_id: CASCADE -> SET NULL, column nullable.
--    Deleting a goal used to erase every contribution row with it, which
--    retroactively rewrote history: the savings-rate report sums contribution
--    rows, so deleting an 18-month-old goal silently dropped those months'
--    savings to zero. Contribution rows are a financial record of money that
--    actually moved; they outlive the goal they were pointed at. (PRODUCT
--    DECISION: keep history, unlink the goal.)
--
-- 2. savings_goal_contributions.transaction_id: no FK at all -> SET NULL, and
--    the column becomes nullable. Two reasons. (a) Finding A7: deleting a
--    transaction left the contribution row behind with a dangling id that no
--    cleanup job and no integrity check would ever find, still counting toward
--    the savings rate. Compare transaction_splits/tags/custom_field_values,
--    which all got transaction_id CASCADE in 0018, and debt_payments, which got
--    SET NULL — contributions got neither. (b) Finding A2: the manual "+$X"
--    button has no transaction behind it, so it could not record a contribution
--    row at all while this column was NOT NULL.
--
-- 3. savings_milestones had ZERO foreign keys (verified: a raw DELETE FROM
--    savings_goals left every milestone row behind) and no uniqueness, so the
--    check-then-insert in checkMilestones could race two rows for the same
--    (goal, percentage) and notify twice (A12/A18).
--
-- SQLite cannot ALTER TABLE ADD CONSTRAINT, so both children are rebuilt
-- (create -> copy -> drop -> rename) exactly as migration 0018 did. Orphan
-- cleanup runs first so the rebuild never carries a row that would violate its
-- own new constraint. savings_goal_contributions keeps STRICT.
-- ---- Orphan cleanup (idempotent; a no-op on a clean DB) ----
UPDATE savings_goal_contributions SET goal_id = NULL WHERE goal_id IS NOT NULL AND goal_id NOT IN (SELECT id FROM savings_goals);--> statement-breakpoint
UPDATE savings_goal_contributions SET transaction_id = NULL WHERE transaction_id IS NOT NULL AND transaction_id NOT IN (SELECT id FROM transactions);--> statement-breakpoint
DELETE FROM savings_milestones WHERE goal_id NOT IN (SELECT id FROM savings_goals);--> statement-breakpoint
-- Collapse any duplicate (goal_id, percentage) rows the check-then-insert race
-- may already have created, keeping the earliest.
DELETE FROM savings_milestones WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM savings_milestones GROUP BY goal_id, percentage
);--> statement-breakpoint

-- ====================== savings_goal_contributions ======================
CREATE TABLE `__new_savings_goal_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text,
	`goal_id` text,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`amount_cents` integer,
	FOREIGN KEY (`goal_id`) REFERENCES `savings_goals`(`id`) ON DELETE SET NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL
) STRICT;--> statement-breakpoint
INSERT INTO `__new_savings_goal_contributions` (`id`,`transaction_id`,`goal_id`,`user_id`,`household_id`,`amount`,`created_at`,`amount_cents`)
SELECT `id`,`transaction_id`,`goal_id`,`user_id`,`household_id`,`amount`,`created_at`,`amount_cents` FROM `savings_goal_contributions`;--> statement-breakpoint
DROP TABLE `savings_goal_contributions`;--> statement-breakpoint
ALTER TABLE `__new_savings_goal_contributions` RENAME TO `savings_goal_contributions`;--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_transaction` ON `savings_goal_contributions` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_goal` ON `savings_goal_contributions` (`goal_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_user_household` ON `savings_goal_contributions` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_goal_created` ON `savings_goal_contributions` (`goal_id`,`created_at`);--> statement-breakpoint

-- ============================ savings_milestones ============================
CREATE TABLE `__new_savings_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`percentage` integer NOT NULL,
	`milestone_amount` real NOT NULL,
	`achieved_at` text,
	`notification_sent_at` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (`goal_id`) REFERENCES `savings_goals`(`id`) ON DELETE CASCADE
);--> statement-breakpoint
INSERT INTO `__new_savings_milestones` (`id`,`goal_id`,`user_id`,`household_id`,`percentage`,`milestone_amount`,`achieved_at`,`notification_sent_at`,`notes`,`created_at`)
SELECT `id`,`goal_id`,`user_id`,`household_id`,`percentage`,`milestone_amount`,`achieved_at`,`notification_sent_at`,`notes`,`created_at` FROM `savings_milestones`;--> statement-breakpoint
DROP TABLE `savings_milestones`;--> statement-breakpoint
ALTER TABLE `__new_savings_milestones` RENAME TO `savings_milestones`;--> statement-breakpoint
CREATE INDEX `idx_savings_milestones_user` ON `savings_milestones` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_milestones_household` ON `savings_milestones` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_milestones_user_household` ON `savings_milestones` (`user_id`,`household_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_milestones_goal` ON `savings_milestones` (`goal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_savings_milestones_goal_percentage` ON `savings_milestones` (`goal_id`,`percentage`);
