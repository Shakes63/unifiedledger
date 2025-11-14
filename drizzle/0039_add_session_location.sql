-- Add location fields to user_sessions table for GeoIP lookup
ALTER TABLE `user_sessions` ADD COLUMN `city` TEXT;
ALTER TABLE `user_sessions` ADD COLUMN `region` TEXT;
ALTER TABLE `user_sessions` ADD COLUMN `country` TEXT;
ALTER TABLE `user_sessions` ADD COLUMN `country_code` TEXT;
