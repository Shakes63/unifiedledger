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
    const result = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);
    return result.length > 0;
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
    const oldSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // Fetch old notification preferences
    const oldNotifications = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    // Create new household preferences with migrated data
    const oldSettingsData = oldSettings[0];
    const oldNotificationsData = oldNotifications[0];
    const newPreferences = {
      id: uuidv4(),
      userId,
      householdId,

      // Preferences (from user_settings)
      dateFormat: oldSettingsData?.dateFormat || 'MM/DD/YYYY',
      numberFormat: oldSettingsData?.numberFormat || 'en-US',
      defaultAccountId: oldSettingsData?.defaultAccountId || null,
      firstDayOfWeek: oldSettingsData?.firstDayOfWeek || 'sunday',

      // Financial Display (from user_settings)
      showCents: oldSettingsData?.showCents ?? true,
      negativeNumberFormat: oldSettingsData?.negativeNumberFormat || '-$100',
      defaultTransactionType: oldSettingsData?.defaultTransactionType || 'expense',

      // Theme (from user_settings)
      theme: oldSettingsData?.theme || 'dark-mode',

      // Notifications - Bill Reminders (from notification_preferences)
      // Note: Old field was billReminderEnabled, new is billRemindersEnabled
      billRemindersEnabled: oldNotificationsData?.billReminderEnabled ?? true,
      billRemindersChannels: oldNotificationsData?.billReminderChannels || '["push"]',

      // Notifications - Budget Warnings
      budgetWarningsEnabled: oldNotificationsData?.budgetWarningEnabled ?? true,
      budgetWarningsChannels: oldNotificationsData?.budgetWarningChannels || '["push"]',

      // Notifications - Budget Exceeded
      budgetExceededEnabled: oldNotificationsData?.budgetExceededAlert ?? true,
      budgetExceededChannels: oldNotificationsData?.budgetExceededChannels || '["push"]',

      // Notifications - Budget Reviews
      budgetReviewEnabled: oldNotificationsData?.budgetReviewEnabled ?? true,
      budgetReviewChannels: oldNotificationsData?.budgetReviewChannels || '["push"]',

      // Notifications - Low Balance
      lowBalanceEnabled: oldNotificationsData?.lowBalanceAlertEnabled ?? true,
      lowBalanceChannels: oldNotificationsData?.lowBalanceChannels || '["push"]',

      // Notifications - Savings Milestones
      // Note: Old field was savingsMilestoneEnabled, new is savingsMilestonesEnabled
      savingsMilestonesEnabled: oldNotificationsData?.savingsMilestoneEnabled ?? true,
      savingsMilestonesChannels: oldNotificationsData?.savingsMilestoneChannels || '["push"]',

      // Notifications - Debt Milestones
      debtMilestonesEnabled: oldNotificationsData?.debtMilestoneEnabled ?? true,
      debtMilestonesChannels: oldNotificationsData?.debtMilestoneChannels || '["push"]',

      // Notifications - Weekly Summaries
      weeklySummariesEnabled: oldNotificationsData?.weeklySummaryEnabled ?? false,
      weeklySummariesChannels: oldNotificationsData?.weeklySummaryChannels || '["email"]',

      // Notifications - Monthly Summaries
      monthlySummariesEnabled: oldNotificationsData?.monthlySummaryEnabled ?? true,
      monthlySummariesChannels: oldNotificationsData?.monthlySummaryChannels || '["email"]',

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
 * @returns The household preferences row
 */
export async function getOrMigratePreferences(
  userId: string,
  householdId: string
): Promise<typeof userHouseholdPreferences.$inferSelect> {
  try {
    // Try to get existing preferences
    let prefs = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    // If not found, migrate and try again
    if (!prefs || prefs.length === 0) {
      console.log(`No preferences found for user ${userId} in household ${householdId}, migrating...`);
      await migrateUserPreferences(userId, householdId);

      prefs = await db
        .select()
        .from(userHouseholdPreferences)
        .where(
          and(
            eq(userHouseholdPreferences.userId, userId),
            eq(userHouseholdPreferences.householdId, householdId)
          )
        )
        .limit(1);
    }

    if (!prefs || prefs.length === 0) {
      throw new Error('Failed to create or retrieve household preferences');
    }

    return prefs[0];
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
