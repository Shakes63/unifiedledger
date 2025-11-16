import { writeFile, mkdir, readFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const BACKUP_DIR = join(process.cwd(), 'backups');

/**
 * Get backup directory path for a user
 */
export function getUserBackupDir(userId: string): string {
  return join(BACKUP_DIR, userId);
}

/**
 * Ensure backup directory exists for a user
 */
export async function ensureBackupDir(userId: string): Promise<void> {
  const userDir = getUserBackupDir(userId);
  if (!existsSync(userDir)) {
    await mkdir(userDir, { recursive: true });
  }
}

/**
 * Generate backup filename
 */
export function generateBackupFilename(format: 'json' | 'csv' = 'json'): string {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  return `unifiedledger-backup-${dateStr}-${timeStr}.${format}`;
}

/**
 * Get full file path for a backup
 */
export function getBackupFilePath(userId: string, filename: string): string {
  return join(getUserBackupDir(userId), filename);
}

/**
 * Save backup file to disk
 */
export async function saveBackupFile(
  userId: string,
  filename: string,
  content: string
): Promise<{ filePath: string; fileSize: number }> {
  await ensureBackupDir(userId);
  const filePath = getBackupFilePath(userId, filename);
  await writeFile(filePath, content, 'utf-8');
  const stats = await stat(filePath);
  return { filePath, fileSize: stats.size };
}

/**
 * Read backup file from disk
 */
export async function readBackupFile(userId: string, filename: string): Promise<string> {
  const filePath = getBackupFilePath(userId, filename);
  return await readFile(filePath, 'utf-8');
}

/**
 * Delete backup file from disk
 */
export async function deleteBackupFile(userId: string, filename: string): Promise<void> {
  const filePath = getBackupFilePath(userId, filename);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

/**
 * Check if backup file exists
 */
export async function backupFileExists(userId: string, filename: string): Promise<boolean> {
  const filePath = getBackupFilePath(userId, filename);
  return existsSync(filePath);
}

