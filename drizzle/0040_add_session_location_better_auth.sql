-- Add location fields to Better Auth session table for GeoIP lookup
ALTER TABLE `session` ADD COLUMN `city` TEXT;
ALTER TABLE `session` ADD COLUMN `region` TEXT;
ALTER TABLE `session` ADD COLUMN `country` TEXT;
ALTER TABLE `session` ADD COLUMN `country_code` TEXT;
