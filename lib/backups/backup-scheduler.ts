import { db } from '@/lib/db';
import { backupSettings } from '@/lib/db/schema';
import { and, eq, lte, sql } from 'drizzle-orm';
import { createUserBackup } from './create-backup';

export interface SchedulerResult {
  householdsProcessed: number;
  backupsCreated: number;
  errors: number;
  errorDetails: Array<{ userId: string; householdId: string; error: string }>;
}

/**
 * Calculate next backup time based on frequency
 * @param frequency - Backup frequency ('daily', 'weekly', 'monthly')
 * @param lastBackupAt - Date of last backup (or current date if first backup)
 * @returns ISO string of next backup time
 */
export function calculateNextBackupAt(
  frequency: 'daily' | 'weekly' | 'monthly',
  lastBackupAt: Date = new Date()
): string {
  const now = new Date(lastBackupAt);
  let nextBackup: Date;

  switch (frequency) {
    case 'daily':
      // Next day at 2 AM UTC
      nextBackup = new Date(now);
      nextBackup.setUTCDate(nextBackup.getUTCDate() + 1);
      nextBackup.setUTCHours(2, 0, 0, 0);
      break;
    case 'weekly':
      // Next Monday at 2 AM UTC
      nextBackup = new Date(now);
      const currentDay = nextBackup.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysUntilMonday = (8 - currentDay) % 7 || 7; // Next Monday
      nextBackup.setUTCDate(nextBackup.getUTCDate() + daysUntilMonday);
      nextBackup.setUTCHours(2, 0, 0, 0);
      break;
    case 'monthly':
      // First day of next month at 2 AM UTC
      nextBackup = new Date(now);
      nextBackup.setUTCMonth(nextBackup.getUTCMonth() + 1);
      nextBackup.setUTCDate(1);
      nextBackup.setUTCHours(2, 0, 0, 0);
      break;
  }

  return nextBackup.toISOString();
}

/**
 * Process scheduled backups for all households that need them
 * @param maxHouseholds - Maximum number of households to process per run (default: 100)
 * @returns Summary of backup processing results
 */
export async function processScheduledBackups(
  maxHouseholds: number = 100
): Promise<SchedulerResult> {
  const result: SchedulerResult = {
    householdsProcessed: 0,
    backupsCreated: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    const now = new Date().toISOString();

    // Query households with enabled backups and nextBackupAt <= now
    // Each user-household pair is a separate backup setting
    const householdsNeedingBackups = await db
      .select()
      .from(backupSettings)
      .where(
        and(
          eq(backupSettings.enabled, true),
          lte(backupSettings.nextBackupAt, now)
        )
      )
      .limit(maxHouseholds);

    console.log(
      `[Backup Scheduler] Found ${householdsNeedingBackups.length} households needing backups`
    );

    result.householdsProcessed = householdsNeedingBackups.length;

    // Process each household's backup
    for (const settings of householdsNeedingBackups) {
      try {
        console.log(
          `[Backup Scheduler] Processing backup for user: ${settings.userId}, household: ${settings.householdId}`
        );

        // Create backup for this household
        const backupResult = await createUserBackup(
          settings.userId,
          settings.householdId,
          settings.format || undefined
        );

        if (!backupResult.success) {
          result.errors++;
          result.errorDetails.push({
            userId: settings.userId,
            householdId: settings.householdId,
            error: backupResult.error || 'Unknown error',
          });
          console.error(
            `[Backup Scheduler] Failed to create backup for user ${settings.userId}, household ${settings.householdId}: ${backupResult.error}`
          );
          // Don't update nextBackupAt if backup failed (will retry next run)
          continue;
        }

        // Backup created successfully - update nextBackupAt
        const lastBackupAt = new Date();
        const nextBackupAt = calculateNextBackupAt(
          settings.frequency as 'daily' | 'weekly' | 'monthly',
          lastBackupAt
        );

        await db
          .update(backupSettings)
          .set({
            lastBackupAt: lastBackupAt.toISOString(),
            nextBackupAt,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(backupSettings.userId, settings.userId),
              eq(backupSettings.householdId, settings.householdId)
            )
          );

        result.backupsCreated++;
        console.log(
          `[Backup Scheduler] Backup created successfully for user ${settings.userId}, household ${settings.householdId}. Next backup: ${nextBackupAt}`
        );
      } catch (error) {
        result.errors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errorDetails.push({
          userId: settings.userId,
          householdId: settings.householdId,
          error: errorMessage,
        });
        console.error(
          `[Backup Scheduler] Error processing backup for user ${settings.userId}, household ${settings.householdId}:`,
          error
        );
        // Continue with next household even if this one failed
      }
    }

    console.log(
      `[Backup Scheduler] Completed: ${result.backupsCreated} backups created, ${result.errors} errors`
    );

    return result;
  } catch (error) {
    console.error('[Backup Scheduler] Fatal error:', error);
    throw error;
  }
}

