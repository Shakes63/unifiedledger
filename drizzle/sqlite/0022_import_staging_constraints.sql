-- CSV import table constraints (bug-hunt findings A9, A21, A19).
--
-- Verified before this migration: import_history, import_staging and
-- import_templates had ZERO foreign keys — every other money-link child table
-- got them in 0018/0021, and the import tables were skipped entirely.
--
-- 1. import_staging.import_history_id -> import_history(id) ON DELETE CASCADE.
--    Staging rows are meaningless without their parent import, and they were
--    only ever reachable BY that parent id, so deleting a history row leaked
--    them permanently.
--
-- 2. UNIQUE(import_history_id, row_number) on import_staging. This is the
--    constraint that would have turned finding A3's concurrent double-import
--    into a caught error instead of silent duplication. The row claim added in
--    the confirm route is the primary fix; this is the backstop.
--
-- 3. import_history.template_id -> import_templates(id) ON DELETE SET NULL.
--    Deleting a template left every historical import pointing at nothing
--    (A19). Harmless today only because template_id is write-only; it becomes a
--    real bug the moment an import-history UI reads it back.
--
-- NOT changed here: transactions.import_history_id. `transactions` is a parent
-- table that 0018 deliberately never rebuilt, and rebuilding it for this alone
-- is not worth the risk on a live money table. The dangling-reference hazard is
-- instead closed in code — cleanOldImportHistory now refuses to delete an
-- import that transactions still reference.
--
-- SQLite cannot ALTER TABLE ADD CONSTRAINT, so each table is rebuilt
-- (create -> copy -> drop -> rename), exactly as 0018 and 0021 did. Orphan
-- cleanup runs first so the rebuild never carries a row that would violate its
-- own new constraint.
-- ---- Orphan cleanup (idempotent; a no-op on a clean DB) ----
DELETE FROM import_staging WHERE import_history_id NOT IN (SELECT id FROM import_history);--> statement-breakpoint
-- Collapse duplicate (import_history_id, row_number) rows, keeping the earliest.
DELETE FROM import_staging WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM import_staging GROUP BY import_history_id, row_number
);--> statement-breakpoint
UPDATE import_history SET template_id = NULL WHERE template_id IS NOT NULL AND template_id NOT IN (SELECT id FROM import_templates);--> statement-breakpoint

-- ============================== import_staging ==============================
CREATE TABLE `__new_import_staging` (
	`id` text PRIMARY KEY NOT NULL,
	`import_history_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw_data` text NOT NULL,
	`mapped_data` text NOT NULL,
	`duplicate_of` text,
	`duplicate_score` real,
	`status` text NOT NULL,
	`validation_errors` text,
	`cc_transaction_type` text,
	`potential_transfer_id` text,
	`transfer_match_confidence` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	FOREIGN KEY (`import_history_id`) REFERENCES `import_history`(`id`) ON DELETE CASCADE
);--> statement-breakpoint
INSERT INTO `__new_import_staging` (`id`,`import_history_id`,`row_number`,`raw_data`,`mapped_data`,`duplicate_of`,`duplicate_score`,`status`,`validation_errors`,`cc_transaction_type`,`potential_transfer_id`,`transfer_match_confidence`,`created_at`)
SELECT `id`,`import_history_id`,`row_number`,`raw_data`,`mapped_data`,`duplicate_of`,`duplicate_score`,`status`,`validation_errors`,`cc_transaction_type`,`potential_transfer_id`,`transfer_match_confidence`,`created_at` FROM `import_staging`;--> statement-breakpoint
DROP TABLE `import_staging`;--> statement-breakpoint
ALTER TABLE `__new_import_staging` RENAME TO `import_staging`;--> statement-breakpoint
CREATE INDEX `idx_import_staging_history` ON `import_staging` (`import_history_id`);--> statement-breakpoint
CREATE INDEX `idx_import_staging_cc_type` ON `import_staging` (`cc_transaction_type`);--> statement-breakpoint
CREATE INDEX `idx_import_staging_transfer` ON `import_staging` (`potential_transfer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_import_staging_history_row` ON `import_staging` (`import_history_id`,`row_number`);--> statement-breakpoint

-- ============================== import_history ==============================
CREATE TABLE `__new_import_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text,
	`template_id` text,
	`filename` text NOT NULL,
	`file_size` integer,
	`rows_total` integer NOT NULL,
	`rows_imported` integer NOT NULL,
	`rows_skipped` integer NOT NULL,
	`rows_duplicates` integer NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`import_settings` text,
	`source_type` text,
	`statement_info` text,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	`completed_at` text,
	`rolled_back_at` text,
	FOREIGN KEY (`template_id`) REFERENCES `import_templates`(`id`) ON DELETE SET NULL
);--> statement-breakpoint
INSERT INTO `__new_import_history` (`id`,`user_id`,`household_id`,`template_id`,`filename`,`file_size`,`rows_total`,`rows_imported`,`rows_skipped`,`rows_duplicates`,`status`,`error_message`,`import_settings`,`source_type`,`statement_info`,`started_at`,`completed_at`,`rolled_back_at`)
SELECT `id`,`user_id`,`household_id`,`template_id`,`filename`,`file_size`,`rows_total`,`rows_imported`,`rows_skipped`,`rows_duplicates`,`status`,`error_message`,`import_settings`,`source_type`,`statement_info`,`started_at`,`completed_at`,`rolled_back_at` FROM `import_history`;--> statement-breakpoint
DROP TABLE `import_history`;--> statement-breakpoint
ALTER TABLE `__new_import_history` RENAME TO `import_history`;--> statement-breakpoint
CREATE INDEX `idx_import_history_user` ON `import_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_import_history_user_created` ON `import_history` (`user_id`,`started_at`);
