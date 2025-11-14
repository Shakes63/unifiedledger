-- Add pending_email field to user table for email change verification flow
ALTER TABLE `user` ADD COLUMN `pending_email` TEXT;
