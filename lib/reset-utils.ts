/**
 * Utility functions for resetting user data and settings
 */

import { db } from '@/lib/db';
import {
  userSettings,
  notificationPreferences,
  savedSearchFilters,
  searchHistory,
  importStaging,
  importHistory,
  ruleExecutionLog,
  dataExportRequests,
  accountDeletionRequests,
  importTemplates,
} from '@/lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_USER_SETTINGS,
  RULE_LOG_RETENTION_DAYS,
} from '@/lib/constants/default-settings';

/**
 * Reset user settings to defaults
 * @param userId - The user ID to reset settings for
 * @returns Updated settings object
 */
export async function resetUserSettings(userId: string) {
  const now = new Date().toISOString();

  // Check if user settings exist
  const existingSettings = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (existingSettings && existingSettings.length > 0) {
    // Update existing settings with defaults
    await db
      .update(userSettings)
      .set({
        ...DEFAULT_USER_SETTINGS,
        updatedAt: now,
      })
      .where(eq(userSettings.userId, userId));
  } else {
    // Create new settings record with defaults
    await db.insert(userSettings).values({
      id: uuidv4(),
      userId,
      ...DEFAULT_USER_SETTINGS,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Fetch and return updated settings
  const updated = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return updated[0];
}

/**
 * Reset notification preferences to defaults
 * @param userId - The user ID to reset preferences for
 * @returns Updated preferences object
 */
export async function resetNotificationPreferences(userId: string) {
  const now = new Date().toISOString();

  // Check if notification preferences exist
  const existingPrefs = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (existingPrefs && existingPrefs.length > 0) {
    // Delete existing preferences - they will be recreated with defaults below
    await db
      .delete(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
  }

  // Create new preferences record with defaults from schema
  // The schema already has default values defined for all notification settings
  await db.insert(notificationPreferences).values({
    id: uuidv4(),
    userId,
    createdAt: now,
    updatedAt: now,
  });

  // Fetch and return updated preferences
  const updated = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  return updated[0];
}

/**
 * Clear temporary and cached data for a user
 * @param userId - The user ID to clear caches for
 * @returns Object with count of cleared items per table
 */
export async function clearUserCaches(userId: string) {
  const counts = {
    savedSearchFilters: 0,
    searchHistory: 0,
    importStaging: 0,
    ruleExecutionLog: 0,
    dataExportRequests: 0,
    accountDeletionRequests: 0,
    importTemplates: 0,
  };

  // Clear saved search filters
  const deletedFilters = await db
    .delete(savedSearchFilters)
    .where(eq(savedSearchFilters.userId, userId));
  counts.savedSearchFilters = deletedFilters.changes || 0;

  // Clear search history
  const deletedHistory = await db
    .delete(searchHistory)
    .where(eq(searchHistory.userId, userId));
  counts.searchHistory = deletedHistory.changes || 0;

  // Clear import staging (delete staging records for user's import history)
  const userImportHistoryIds = await db
    .select({ id: importHistory.id })
    .from(importHistory)
    .where(eq(importHistory.userId, userId));

  let stagingCount = 0;
  for (const history of userImportHistoryIds) {
    const deleted = await db
      .delete(importStaging)
      .where(eq(importStaging.importHistoryId, history.id));
    stagingCount += deleted.changes || 0;
  }
  counts.importStaging = stagingCount;

  // Clear old rule execution logs (keep last 30 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RULE_LOG_RETENTION_DAYS);
  const deletedLogs = await db
    .delete(ruleExecutionLog)
    .where(
      and(
        eq(ruleExecutionLog.userId, userId),
        lt(ruleExecutionLog.executedAt, cutoffDate.toISOString())
      )
    );
  counts.ruleExecutionLog = deletedLogs.changes || 0;

  // Clear data export requests
  const deletedExports = await db
    .delete(dataExportRequests)
    .where(eq(dataExportRequests.userId, userId));
  counts.dataExportRequests = deletedExports.changes || 0;

  // Clear account deletion requests
  const deletedDeletions = await db
    .delete(accountDeletionRequests)
    .where(eq(accountDeletionRequests.userId, userId));
  counts.accountDeletionRequests = deletedDeletions.changes || 0;

  // Clear import templates
  const deletedTemplates = await db
    .delete(importTemplates)
    .where(eq(importTemplates.userId, userId));
  counts.importTemplates = deletedTemplates.changes || 0;

  return counts;
}

/**
 * Log the reset action to household activity log
 * @param userId - The user ID who performed the reset
 * @param clearedCounts - Object with counts of cleared items
 */
export async function logResetAction(
  userId: string,
  clearedCounts: Record<string, number>
) {
  const now = new Date().toISOString();

  // Log the reset action for auditing purposes
  console.log(`[Reset App Data] User ${userId} reset app data:`, {
    settingsReset: true,
    preferencesReset: true,
    cachesCleared: Object.keys(clearedCounts).filter((key) => clearedCounts[key] > 0),
    clearedCounts,
    timestamp: now,
  });

  // Note: We don't add to householdActivityLog because reset is a user-level action
  // and the schema's activity types are all household-entity specific
}

/**
 * Check if user has exceeded reset rate limit
 * @param userId - The user ID to check
 * @param maxAttempts - Maximum allowed attempts (default: 3)
 * @returns true if rate limit exceeded, false otherwise
 */
export async function checkResetRateLimit(
  _userId: string,
  _maxAttempts: number = 3
): Promise<boolean> {
  // TODO: Implement proper rate limiting using a dedicated tracking table
  // For now, we rely on the API endpoint's rate limiting logic
  // which tracks reset attempts in memory or a separate store
  return false;
}

/**
 * Perform complete reset of user data
 * This is the main function that orchestrates the entire reset process
 * @param userId - The user ID to reset data for
 * @returns Object with details of what was reset
 */
export async function performUserDataReset(userId: string) {
  // Reset settings
  const updatedSettings = await resetUserSettings(userId);

  // Reset notification preferences
  const updatedPreferences = await resetNotificationPreferences(userId);

  // Clear caches
  const clearedCounts = await clearUserCaches(userId);

  // Log the action
  await logResetAction(userId, clearedCounts);

  return {
    success: true,
    settingsReset: true,
    preferencesReset: true,
    clearedCounts,
    updatedSettings,
    updatedPreferences,
  };
}
