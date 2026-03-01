CREATE TABLE IF NOT EXISTS `household_entities` (
  `id` text PRIMARY KEY NOT NULL,
  `household_id` text NOT NULL,
  `name` text NOT NULL,
  `type` text NOT NULL,
  `is_default` integer DEFAULT false,
  `enable_sales_tax` integer DEFAULT false,
  `is_active` integer DEFAULT true,
  `created_by` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_household_entities_household_name` ON `household_entities` (`household_id`,`name`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_household_entities_household` ON `household_entities` (`household_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_household_entities_type` ON `household_entities` (`household_id`,`type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_household_entities_default` ON `household_entities` (`household_id`,`is_default`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `household_entity_members` (
  `id` text PRIMARY KEY NOT NULL,
  `entity_id` text NOT NULL,
  `household_id` text NOT NULL,
  `user_id` text NOT NULL,
  `role` text DEFAULT 'viewer',
  `can_manage_entity` integer DEFAULT false,
  `is_active` integer DEFAULT true,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_household_entity_members_unique` ON `household_entity_members` (`entity_id`,`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_household_entity_members_household_user` ON `household_entity_members` (`household_id`,`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_household_entity_members_entity_active` ON `household_entity_members` (`entity_id`,`is_active`);
