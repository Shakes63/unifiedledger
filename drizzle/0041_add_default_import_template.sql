-- Add default import template preference to user_settings
ALTER TABLE `user_settings` ADD COLUMN `default_import_template_id` TEXT;
