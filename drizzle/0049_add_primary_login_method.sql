-- Add primary_login_method field to user_settings table
-- This field tracks the user's preferred login method: 'email', 'google', or 'github'
ALTER TABLE user_settings ADD COLUMN primary_login_method TEXT DEFAULT 'email';

