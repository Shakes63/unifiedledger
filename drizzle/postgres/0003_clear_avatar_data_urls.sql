-- Clear data URLs from user.image to prevent session cookie bloat
-- Avatars are now stored in user_settings.avatar_url instead
UPDATE "user" SET image = NULL WHERE image LIKE 'data:%';
