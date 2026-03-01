CREATE TABLE IF NOT EXISTS `bill_templates` (
  `id` text PRIMARY KEY NOT NULL,
  `household_id` text NOT NULL,
  `created_by_user_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `is_active` integer NOT NULL DEFAULT true,
  `bill_type` text NOT NULL,
  `classification` text NOT NULL,
  `classification_subcategory` text,
  `recurrence_type` text NOT NULL,
  `recurrence_due_day` integer,
  `recurrence_due_weekday` integer,
  `recurrence_specific_due_date` text,
  `recurrence_start_month` integer,
  `default_amount_cents` integer NOT NULL DEFAULT 0,
  `is_variable_amount` integer NOT NULL DEFAULT false,
  `amount_tolerance_bps` integer NOT NULL DEFAULT 500,
  `category_id` text,
  `merchant_id` text,
  `payment_account_id` text,
  `linked_liability_account_id` text,
  `charged_to_account_id` text,
  `auto_mark_paid` integer NOT NULL DEFAULT true,
  `notes` text,
  `debt_enabled` integer NOT NULL DEFAULT false,
  `debt_original_balance_cents` integer,
  `debt_remaining_balance_cents` integer,
  `debt_interest_apr_bps` integer,
  `debt_interest_type` text,
  `debt_start_date` text,
  `debt_color` text,
  `include_in_payoff_strategy` integer NOT NULL DEFAULT true,
  `interest_tax_deductible` integer NOT NULL DEFAULT false,
  `interest_tax_deduction_type` text NOT NULL DEFAULT 'none',
  `interest_tax_deduction_limit_cents` integer,
  `budget_period_assignment` integer,
  `split_across_periods` integer NOT NULL DEFAULT false,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_templates_household_active` ON `bill_templates` (`household_id`,`is_active`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_templates_household_type` ON `bill_templates` (`household_id`,`bill_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_templates_household_class` ON `bill_templates` (`household_id`,`classification`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_templates_linked_liability` ON `bill_templates` (`household_id`,`linked_liability_account_id`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `bill_occurrences` (
  `id` text PRIMARY KEY NOT NULL,
  `template_id` text NOT NULL,
  `household_id` text NOT NULL,
  `due_date` text NOT NULL,
  `status` text NOT NULL DEFAULT 'unpaid',
  `amount_due_cents` integer NOT NULL,
  `amount_paid_cents` integer NOT NULL DEFAULT 0,
  `amount_remaining_cents` integer NOT NULL,
  `actual_amount_cents` integer,
  `paid_date` text,
  `last_transaction_id` text,
  `days_late` integer NOT NULL DEFAULT 0,
  `late_fee_cents` integer NOT NULL DEFAULT 0,
  `is_manual_override` integer NOT NULL DEFAULT false,
  `budget_period_override` integer,
  `notes` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_bill_occurrences_template_due` ON `bill_occurrences` (`template_id`,`due_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_occurrences_household_due` ON `bill_occurrences` (`household_id`,`due_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_occurrences_household_status_due` ON `bill_occurrences` (`household_id`,`status`,`due_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_occurrences_template` ON `bill_occurrences` (`template_id`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `bill_occurrence_allocations` (
  `id` text PRIMARY KEY NOT NULL,
  `occurrence_id` text NOT NULL,
  `template_id` text NOT NULL,
  `household_id` text NOT NULL,
  `period_number` integer NOT NULL,
  `allocated_amount_cents` integer NOT NULL,
  `paid_amount_cents` integer NOT NULL DEFAULT 0,
  `is_paid` integer NOT NULL DEFAULT false,
  `payment_event_id` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_bill_occurrence_allocations_unique` ON `bill_occurrence_allocations` (`occurrence_id`,`period_number`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_occurrence_allocations_household_occurrence` ON `bill_occurrence_allocations` (`household_id`,`occurrence_id`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `bill_payment_events` (
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
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_bill_payment_events_idempotency` ON `bill_payment_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_payment_events_household_date` ON `bill_payment_events` (`household_id`,`payment_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_payment_events_occurrence` ON `bill_payment_events` (`occurrence_id`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `autopay_rules` (
  `id` text PRIMARY KEY NOT NULL,
  `template_id` text NOT NULL,
  `household_id` text NOT NULL,
  `is_enabled` integer NOT NULL DEFAULT false,
  `pay_from_account_id` text NOT NULL,
  `amount_type` text NOT NULL,
  `fixed_amount_cents` integer,
  `days_before_due` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_autopay_rules_template` ON `autopay_rules` (`template_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_autopay_rules_household_enabled` ON `autopay_rules` (`household_id`,`is_enabled`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `autopay_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `household_id` text NOT NULL,
  `run_date` text NOT NULL,
  `run_type` text NOT NULL,
  `status` text NOT NULL,
  `processed_count` integer NOT NULL DEFAULT 0,
  `success_count` integer NOT NULL DEFAULT 0,
  `failed_count` integer NOT NULL DEFAULT 0,
  `skipped_count` integer NOT NULL DEFAULT 0,
  `total_amount_cents` integer NOT NULL DEFAULT 0,
  `error_summary` text,
  `started_at` text NOT NULL,
  `completed_at` text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_autopay_runs_household_date` ON `autopay_runs` (`household_id`,`run_date`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `bill_match_events` (
  `id` text PRIMARY KEY NOT NULL,
  `household_id` text NOT NULL,
  `transaction_id` text NOT NULL,
  `template_id` text,
  `occurrence_id` text,
  `confidence_bps` integer NOT NULL,
  `decision` text NOT NULL,
  `reasons_json` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_match_events_household_tx` ON `bill_match_events` (`household_id`,`transaction_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bill_match_events_household_created` ON `bill_match_events` (`household_id`,`created_at`);
