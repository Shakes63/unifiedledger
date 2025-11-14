-- Add imageUpdatedAt field to user table to track when avatar was last updated

ALTER TABLE user ADD COLUMN image_updated_at integer;
