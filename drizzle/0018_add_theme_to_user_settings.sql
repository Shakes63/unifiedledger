-- Add theme column to user_settings table
-- Migration 0018: Add theme preference field
-- Date: 2025-11-09

ALTER TABLE user_settings ADD COLUMN theme TEXT DEFAULT 'dark-mode';
