-- Migration: Add custom permissions field to household_members table
-- Created: 2025-01-XX
-- Description: Adds custom permission overrides to allow fine-grained permission management beyond role-based defaults

-- Add custom permissions field to household_members table
-- Stores JSON object: { "permission_name": true/false }
-- NULL means no custom overrides (use role defaults)
ALTER TABLE household_members ADD COLUMN custom_permissions TEXT;

