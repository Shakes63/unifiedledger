import { writeFile, mkdir, readFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const BACKUP_DIR = join(process.cwd(), 'backups');

/**
 * Get backup directory path for a user's household
 */
export function getHouseholdBackupDir(userId: string, householdId: string): string {
  return join(BACKUP_DIR, userId, householdId);
}

/**
 * Ensure backup directory exists for a user's household
 */
export async function ensureBackupDir(userId: string, householdId: string): Promise<void> {
  const householdDir = getHouseholdBackupDir(userId, householdId);
  if (!existsSync(householdDir)) {
    await mkdir(householdDir, { recursive: true });
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
export function getBackupFilePath(userId: string, householdId: string, filename: string): string {
  return join(getHouseholdBackupDir(userId, householdId), filename);
}

/**
 * Save backup file to disk
 */
export async function saveBackupFile(
  userId: string,
  householdId: string,
  filename: string,
  content: string
): Promise<{ filePath: string; fileSize: number }> {
  await ensureBackupDir(userId, householdId);
  const filePath = getBackupFilePath(userId, householdId, filename);
  await writeFile(filePath, content, 'utf-8');
  const stats = await stat(filePath);
  return { filePath, fileSize: stats.size };
}

/**
 * Read backup file from disk
 */
export async function readBackupFile(userId: string, householdId: string, filename: string): Promise<string> {
  const filePath = getBackupFilePath(userId, householdId, filename);
  return await readFile(filePath, 'utf-8');
}

/**
 * Delete backup file from disk
 */
export async function deleteBackupFile(userId: string, householdId: string, filename: string): Promise<void> {
  const filePath = getBackupFilePath(userId, householdId, filename);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

/**
 * Check if backup file exists
 */
export async function backupFileExists(userId: string, householdId: string, filename: string): Promise<boolean> {
  const filePath = getBackupFilePath(userId, householdId, filename);
  return existsSync(filePath);
}

