-- Add is_favorite column to household_members table
ALTER TABLE household_members ADD COLUMN is_favorite INTEGER DEFAULT 0;
