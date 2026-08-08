-- Bug-hunt finding R1: budget_rollover_history had only a PLAIN index on
-- (category_id, month), so the rollover engine's check-then-insert was a pure
-- TOCTOU. If the history INSERT failed after the balance UPDATE committed (they
-- were separate autocommits), the next daily cron run saw no history row and
-- re-applied the same month, DOUBLING rolloverBalance — silently, with the cron
-- still reporting success.
--
-- The engine now does the update+insert in one transaction; this UNIQUE index is
-- the structural backstop that makes a double-apply impossible even if that
-- logic regresses.
--
-- Any duplicate rows already written by the old code are collapsed to the
-- FIRST-inserted row for each (category_id, month) — the original computation,
-- before the erroneous re-applications. NOTE: this repairs the history table so
-- the index can be created; it does NOT retroactively correct a
-- budgetCategories.rolloverBalance that was already doubled. Use the new
-- force-recompute path (POST /api/cron/budget-rollover {"month","force":true})
-- to recompute an affected month from actual spending.
DELETE FROM `budget_rollover_history`
WHERE `rowid` NOT IN (
  SELECT MIN(`rowid`) FROM `budget_rollover_history` GROUP BY `category_id`, `month`
);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_rollover_history_category_month`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rollover_history_category_month` ON `budget_rollover_history` (`category_id`,`month`);
