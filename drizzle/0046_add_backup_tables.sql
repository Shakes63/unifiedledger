-- Migration: Add backup_settings and backup_history tables
-- Created: 2025-01-27
-- Feature: Auto-Backup Settings

-- Step 1: Create backup_settings table
CREATE TABLE IF NOT EXISTS backup_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  enabled INTEGER DEFAULT 0,
  frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  format TEXT DEFAULT 'json' CHECK (format IN ('json', 'csv')),
  retention_count INTEGER DEFAULT 10,
  email_backups INTEGER DEFAULT 0,
  last_backup_at TEXT,
  next_backup_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Step 2: Create backup_history table
CREATE TABLE IF NOT EXISTS backup_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  backup_settings_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  format TEXT DEFAULT 'json' CHECK (format IN ('json', 'csv')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_backup_settings_user ON backup_settings(user_id);
CREATE INDEX idx_backup_history_user ON backup_history(user_id);
CREATE INDEX idx_backup_history_created ON backup_history(created_at);
CREATE INDEX idx_backup_history_status ON backup_history(status);
CREATE INDEX idx_backup_history_user_created ON backup_history(user_id, created_at);

