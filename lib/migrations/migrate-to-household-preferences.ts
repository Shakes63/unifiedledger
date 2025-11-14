/**
 * Migration Helper: User Preferences to Household Preferences
 *
 * Migrates user settings from old tables (user_settings, notification_preferences)
 * to the new per-household preferences table (user_household_preferences).
 *
 * This ensures backward compatibility during the transition to per-household settings.
 */

import { db } from '@/lib/db';
import { userSettings, notificationPreferences, userHouseholdPreferences } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Check if a user has household preferences already created
 *
 * @param userId - The user's ID
 * @param householdId - The household's ID
 * @returns Promise<boolean> - True if preferences exist, false otherwise
 */
export async function hasHouseholdPreferences(
  userId: string,
  householdId: string
): Promise<boolean> {
  try {
    const result = await db.query.userHouseholdPreferences.findFirst({
      where: and(
        eq(userHouseholdPreferences.userId, userId),
        eq(userHouseholdPreferences.householdId, householdId)
      ),
    });
    return !!result;
  } catch (error) {
    console.error('Error checking household preferences:', error);
    return false;
  }
}

/**
 * Migrate user's settings to household preferences
 *
 * Copies theme from user_settings and notifications from notification_preferences
 * to create a new user_household_preferences record. This is idempotent and safe
 * to call multiple times.
 *
 * @param userId - The user's ID
 * @param householdId - The household's ID
 */
export async function migrateUserPreferences(
  userId: string,
  householdId: string
): Promise<void> {
  try {
    // Check if already migrated
    const exists = await hasHouseholdPreferences(userId, householdId);
    if (exists) {
      console.log(`Preferences already exist for user ${userId} in household ${householdId}`);
      return;
    }

    // Fetch old user settings (for theme and display preferences)
    const oldSettings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    // Fetch old notification preferences
    const oldNotifications = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });

    // Create new household preferences with migrated data
    const newPreferences = {
      id: uuidv4(),
      userId,
      householdId,

      // Preferences (from user_settings)
      dateFormat: oldSettings?.dateFormat || 'MM/DD/YYYY',
      numberFormat: oldSettings?.numberFormat || 'en-US',
      defaultAccountId: oldSettings?.defaultAccountId || null,
      firstDayOfWeek: oldSettings?.firstDayOfWeek || 'sunday',

      // Financial Display (from user_settings)
      showCents: oldSettings?.showCents ?? true,
      negativeNumberFormat: oldSettings?.negativeNumberFormat || '-$100',
      defaultTransactionType: oldSettings?.defaultTransactionType || 'expense',

      // Theme (from user_settings)
      theme: oldSettings?.theme || 'dark-mode',

      // Notifications - Bill Reminders (from notification_preferences)
      // Note: Old field was billReminderEnabled, new is billRemindersEnabled
      billRemindersEnabled: oldNotifications?.billReminderEnabled ?? true,
      billRemindersChannels: oldNotifications?.billReminderChannels || '["push"]',

      // Notifications - Budget Warnings
      budgetWarningsEnabled: oldNotifications?.budgetWarningEnabled ?? true,
      budgetWarningsChannels: oldNotifications?.budgetWarningChannels || '["push"]',

      // Notifications - Budget Exceeded
      budgetExceededEnabled: oldNotifications?.budgetExceededAlert ?? true,
      budgetExceededChannels: oldNotifications?.budgetExceededChannels || '["push"]',

      // Notifications - Budget Reviews
      budgetReviewEnabled: oldNotifications?.budgetReviewEnabled ?? true,
      budgetReviewChannels: oldNotifications?.budgetReviewChannels || '["push"]',

      // Notifications - Low Balance
      lowBalanceEnabled: oldNotifications?.lowBalanceAlertEnabled ?? true,
      lowBalanceChannels: oldNotifications?.lowBalanceChannels || '["push"]',

      // Notifications - Savings Milestones
      // Note: Old field was savingsMilestoneEnabled, new is savingsMilestonesEnabled
      savingsMilestonesEnabled: oldNotifications?.savingsMilestoneEnabled ?? true,
      savingsMilestonesChannels: oldNotifications?.savingsMilestoneChannels || '["push"]',

      // Notifications - Debt Milestones
      debtMilestonesEnabled: oldNotifications?.debtMilestoneEnabled ?? true,
      debtMilestonesChannels: oldNotifications?.debtMilestoneChannels || '["push"]',

      // Notifications - Weekly Summaries
      weeklySummariesEnabled: oldNotifications?.weeklySummaryEnabled ?? false,
      weeklySummariesChannels: oldNotifications?.weeklySummaryChannels || '["email"]',

      // Notifications - Monthly Summaries
      monthlySummariesEnabled: oldNotifications?.monthlySummaryEnabled ?? true,
      monthlySummariesChannels: oldNotifications?.monthlySummaryChannels || '["email"]',

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.insert(userHouseholdPreferences).values(newPreferences);

    console.log(`Successfully migrated preferences for user ${userId} to household ${householdId}`);
  } catch (error) {
    console.error('Error migrating user preferences:', error);
    throw error;
  }
}

/**
 * Get household preferences with automatic migration if needed
 *
 * This is the main function to use when loading preferences. It will automatically
 * migrate old preferences if they don't exist in the new table yet.
 *
 * @param userId - The user's ID
 * @param householdId - The household's ID
 * @returns Promise<any> - The household preferences object
 */
export async function getOrMigratePreferences(
  userId: string,
  householdId: string
): Promise<any> {
  try {
    // Try to get existing preferences
    let prefs = await db.query.userHouseholdPreferences.findFirst({
      where: and(
        eq(userHouseholdPreferences.userId, userId),
        eq(userHouseholdPreferences.householdId, householdId)
      ),
    });

    // If not found, migrate and try again
    if (!prefs) {
      console.log(`No preferences found for user ${userId} in household ${householdId}, migrating...`);
      await migrateUserPreferences(userId, householdId);

      prefs = await db.query.userHouseholdPreferences.findFirst({
        where: and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        ),
      });
    }

    if (!prefs) {
      throw new Error('Failed to create or retrieve household preferences');
    }

    return prefs;
  } catch (error) {
    console.error('Error getting/migrating preferences:', error);
    throw error;
  }
}

/**
 * Batch migrate all users in a household
 *
 * Useful for administrative tasks or when setting up a new household.
 *
 * @param householdId - The household's ID
 * @param userIds - Array of user IDs to migrate
 */
export async function batchMigrateHousehold(
  householdId: string,
  userIds: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      await migrateUserPreferences(userId, householdId);
      success++;
    } catch (error) {
      console.error(`Failed to migrate user ${userId}:`, error);
      failed++;
    }
  }

  return { success, failed };
}
