-- Make category_id nullable in categorization_rules table
-- Required for rules that use non-category actions (description, merchant, tax, etc.)
--
-- Background: The original schema (migration 0000) defined category_id as NOT NULL.
-- Migration 0020 added the actions column to support multiple action types but didn't
-- alter category_id to be nullable. This causes errors when creating rules without
-- a set_category action.
--
-- Solution: Recreate the table with category_id as nullable (SQLite limitation)

-- Step 1: Create new table with category_id nullable
CREATE TABLE `categorization_rules_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category_id` text,  -- NOW NULLABLE (was NOT NULL)
	`description` text,
	`priority` integer DEFAULT 100,
	`is_active` integer DEFAULT true,
	`conditions` text NOT NULL,
	`actions` text,
	`match_count` integer DEFAULT 0,
	`last_matched_at` text,
	`test_results` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);

-- Step 2: Copy all data from old table to new table
INSERT INTO categorization_rules_new (
	id,
	user_id,
	name,
	category_id,
	description,
	priority,
	is_active,
	conditions,
	actions,
	match_count,
	last_matched_at,
	test_results,
	created_at,
	updated_at
)
SELECT
	id,
	user_id,
	name,
	category_id,
	description,
	priority,
	is_active,
	conditions,
	actions,
	match_count,
	last_matched_at,
	test_results,
	created_at,
	updated_at
FROM categorization_rules;

-- Step 3: Drop old table
DROP TABLE categorization_rules;

-- Step 4: Rename new table to original name
ALTER TABLE categorization_rules_new RENAME TO categorization_rules;

-- Step 5: Recreate indexes
CREATE INDEX `idx_categorization_rules_user` ON `categorization_rules` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_categorization_rules_priority` ON `categorization_rules` (`priority`);
