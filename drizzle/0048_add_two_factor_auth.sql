-- Migration: Add Two-Factor Authentication fields to user table
-- Created: 2025-01-XX
-- Description: Adds 2FA support with TOTP secret, backup codes, and verification tracking

-- Add 2FA fields to user table
ALTER TABLE user ADD COLUMN two_factor_enabled INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE user ADD COLUMN two_factor_secret TEXT;
ALTER TABLE user ADD COLUMN two_factor_backup_codes TEXT; -- JSON array of hashed backup codes
ALTER TABLE user ADD COLUMN two_factor_verified_at INTEGER;

-- Create index for faster lookups of users with 2FA enabled
CREATE INDEX IF NOT EXISTS idx_user_two_factor_enabled ON user(two_factor_enabled);

