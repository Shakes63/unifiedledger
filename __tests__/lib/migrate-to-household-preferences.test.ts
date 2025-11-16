/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hasHouseholdPreferences,
  migrateUserPreferences,
  getOrMigratePreferences,
  batchMigrateHousehold,
} from '@/lib/migrations/migrate-to-household-preferences';
import { db } from '@/lib/db';

/**
 * Comprehensive tests for Migration Helper Utilities
 *
 * Tests the migration from old user_settings/notification_preferences tables
 * to the new user_household_preferences table.
 *
 * Coverage:
 * - hasHouseholdPreferences: Check if preferences exist
 * - migrateUserPreferences: Migrate from old tables
 * - getOrMigratePreferences: Auto-migrate if needed
 * - batchMigrateHousehold: Bulk migration for all household users
 */

// Mock modules
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      userHouseholdPreferences: {
        findFirst: vi.fn(),
      },
      userSettings: {
        findFirst: vi.fn(),
      },
      notificationPreferences: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-migration-uuid-123',
}));

// Test data
const TEST_USER_ID = 'user-123';
const TEST_HOUSEHOLD_ID = 'household-456';

const MOCK_OLD_USER_SETTINGS = {
  id: 'settings-123',
  userId: TEST_USER_ID,
  dateFormat: 'DD/MM/YYYY',
  numberFormat: 'en-GB',
  defaultAccountId: 'account-789',
  firstDayOfWeek: 'monday',
  showCents: false,
  negativeNumberFormat: '($100)',
  defaultTransactionType: 'income',
  theme: 'dark-blue',
};

const MOCK_OLD_NOTIFICATION_PREFERENCES = {
  id: 'notif-123',
  userId: TEST_USER_ID,
  // Old field names (note the singular vs plural differences)
  billReminderEnabled: true,
  billReminderChannels: '["push","email"]',
  budgetWarningEnabled: false,
  budgetWarningChannels: '["email"]',
  budgetExceededAlert: true,
  budgetExceededChannels: '["push"]',
  budgetReviewEnabled: false,
  budgetReviewChannels: '["push"]',
  lowBalanceAlertEnabled: true,
  lowBalanceChannels: '["push","email"]',
  savingsMilestoneEnabled: false, // Singular in old table
  savingsMilestoneChannels: '["push"]',
  debtMilestoneEnabled: true,
  debtMilestoneChannels: '["email"]',
  weeklySummaryEnabled: true,
  weeklySummaryChannels: '["email"]',
  monthlySummaryEnabled: false,
  monthlySummaryChannels: '["push"]',
};

const MOCK_EXISTING_HOUSEHOLD_PREFERENCES = {
  id: 'pref-123',
  userId: TEST_USER_ID,
  householdId: TEST_HOUSEHOLD_ID,
  dateFormat: 'MM/DD/YYYY',
  theme: 'dark-mode',
  billRemindersEnabled: true,
  billRemindersChannels: '["push"]',
};

describe('Migration Helper - hasHouseholdPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return true if preferences exist', async () => {
    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(
      MOCK_EXISTING_HOUSEHOLD_PREFERENCES
    );

    const result = await hasHouseholdPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(result).toBe(true);
    expect(db.query.userHouseholdPreferences.findFirst).toHaveBeenCalled();
  });

  it('should return false if preferences do not exist', async () => {
    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(null);

    const result = await hasHouseholdPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(result).toBe(false);
  });

  it('should return false on database error (graceful degradation)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (db.query.userHouseholdPreferences.findFirst as any).mockRejectedValue(
      new Error('Database error')
    );

    const result = await hasHouseholdPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error checking household preferences:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});

describe('Migration Helper - migrateUserPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should skip migration if preferences already exist', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(
      MOCK_EXISTING_HOUSEHOLD_PREFERENCES
    );

    await migrateUserPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Preferences already exist for user ${TEST_USER_ID} in household ${TEST_HOUSEHOLD_ID}`
    );
    expect(db.insert).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  it('should migrate user settings and notification preferences', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // No existing preferences
    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(null);

    // Mock old settings
    (db.query.userSettings.findFirst as any).mockResolvedValue(MOCK_OLD_USER_SETTINGS);

    // Mock old notifications
    (db.query.notificationPreferences.findFirst as any).mockResolvedValue(
      MOCK_OLD_NOTIFICATION_PREFERENCES
    );

    // Mock db.insert
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    await migrateUserPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(mockInsert).toHaveBeenCalled();
    const insertedValues = mockInsert.mock.results[0].value.values.mock.calls[0][0];

    // Verify migrated preferences
    expect(insertedValues.userId).toBe(TEST_USER_ID);
    expect(insertedValues.householdId).toBe(TEST_HOUSEHOLD_ID);

    // Verify user settings migration
    expect(insertedValues.dateFormat).toBe('DD/MM/YYYY');
    expect(insertedValues.numberFormat).toBe('en-GB');
    expect(insertedValues.theme).toBe('dark-blue');
    expect(insertedValues.showCents).toBe(false);

    // Verify notification migration (note field name changes)
    expect(insertedValues.billRemindersEnabled).toBe(true); // billReminderEnabled → billRemindersEnabled
    expect(insertedValues.billRemindersChannels).toBe('["push","email"]');
    expect(insertedValues.budgetWarningsEnabled).toBe(false);
    expect(insertedValues.savingsMilestonesEnabled).toBe(false); // savingsMilestoneEnabled → savingsMilestonesEnabled

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Successfully migrated preferences for user ${TEST_USER_ID} to household ${TEST_HOUSEHOLD_ID}`
    );

    consoleLogSpy.mockRestore();
  });

  it('should use defaults when old settings are missing', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(null);
    (db.query.userSettings.findFirst as any).mockResolvedValue(null);
    (db.query.notificationPreferences.findFirst as any).mockResolvedValue(null);

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    await migrateUserPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    const insertedValues = mockInsert.mock.results[0].value.values.mock.calls[0][0];

    // Verify defaults are used
    expect(insertedValues.dateFormat).toBe('MM/DD/YYYY');
    expect(insertedValues.numberFormat).toBe('en-US');
    expect(insertedValues.theme).toBe('dark-mode');
    expect(insertedValues.showCents).toBe(true);
    expect(insertedValues.billRemindersEnabled).toBe(true);
    expect(insertedValues.billRemindersChannels).toBe('["push"]');

    consoleLogSpy.mockRestore();
  });

  it('should use defaults when old settings have partial data', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(null);

    // Partial old settings (some fields missing)
    (db.query.userSettings.findFirst as any).mockResolvedValue({
      theme: 'light-bubblegum',
      // Other fields missing
    });

    // Partial old notifications (some fields missing)
    (db.query.notificationPreferences.findFirst as any).mockResolvedValue({
      billReminderEnabled: false,
      // Other fields missing
    });

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    await migrateUserPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    const insertedValues = mockInsert.mock.results[0].value.values.mock.calls[0][0];

    // Verify provided values are used
    expect(insertedValues.theme).toBe('light-bubblegum');
    expect(insertedValues.billRemindersEnabled).toBe(false);

    // Verify defaults are used for missing fields
    expect(insertedValues.dateFormat).toBe('MM/DD/YYYY');
    expect(insertedValues.budgetWarningsEnabled).toBe(true);

    consoleLogSpy.mockRestore();
  });

  it('should throw error on database failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(null);
    (db.query.userSettings.findFirst as any).mockRejectedValue(new Error('Database error'));

    await expect(migrateUserPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID)).rejects.toThrow(
      'Database error'
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error migrating user preferences:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});

describe('Migration Helper - getOrMigratePreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return existing preferences without migration', async () => {
    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(
      MOCK_EXISTING_HOUSEHOLD_PREFERENCES
    );

    const result = await getOrMigratePreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(result).toEqual(MOCK_EXISTING_HOUSEHOLD_PREFERENCES);
    expect(db.query.userSettings.findFirst).not.toHaveBeenCalled(); // No migration needed
  });

  it('should auto-migrate if preferences do not exist', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // First call: no preferences found
    // Second call (after migration): preferences found
    (db.query.userHouseholdPreferences.findFirst as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null) // Called again in migrateUserPreferences (hasHouseholdPreferences)
      .mockResolvedValueOnce(MOCK_EXISTING_HOUSEHOLD_PREFERENCES);

    (db.query.userSettings.findFirst as any).mockResolvedValue(MOCK_OLD_USER_SETTINGS);
    (db.query.notificationPreferences.findFirst as any).mockResolvedValue(
      MOCK_OLD_NOTIFICATION_PREFERENCES
    );

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    const result = await getOrMigratePreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `No preferences found for user ${TEST_USER_ID} in household ${TEST_HOUSEHOLD_ID}, migrating...`
    );
    expect(mockInsert).toHaveBeenCalled(); // Migration happened
    expect(result).toEqual(MOCK_EXISTING_HOUSEHOLD_PREFERENCES);

    consoleLogSpy.mockRestore();
  });

  it('should throw error if migration fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(null);
    (db.query.userSettings.findFirst as any).mockRejectedValue(new Error('Migration failed'));

    await expect(getOrMigratePreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID)).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should throw error if preferences still not found after migration', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Always return null (migration doesn't create preferences for some reason)
    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(null);
    (db.query.userSettings.findFirst as any).mockResolvedValue(MOCK_OLD_USER_SETTINGS);
    (db.query.notificationPreferences.findFirst as any).mockResolvedValue(
      MOCK_OLD_NOTIFICATION_PREFERENCES
    );

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    await expect(getOrMigratePreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID)).rejects.toThrow(
      'Failed to create or retrieve household preferences'
    );

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});

describe('Migration Helper - batchMigrateHousehold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should migrate all users successfully', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const userIds = ['user-1', 'user-2', 'user-3'];

    // Mock that no users have preferences yet
    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(null);
    (db.query.userSettings.findFirst as any).mockResolvedValue(MOCK_OLD_USER_SETTINGS);
    (db.query.notificationPreferences.findFirst as any).mockResolvedValue(
      MOCK_OLD_NOTIFICATION_PREFERENCES
    );

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    const result = await batchMigrateHousehold(TEST_HOUSEHOLD_ID, userIds);

    expect(result.success).toBe(3);
    expect(result.failed).toBe(0);
    expect(mockInsert).toHaveBeenCalledTimes(3); // Once per user

    consoleLogSpy.mockRestore();
  });

  it('should handle partial failures gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const userIds = ['user-1', 'user-2', 'user-3'];

    let callCount = 0;
    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(null);

    // First user succeeds, second fails, third succeeds
    (db.query.userSettings.findFirst as any).mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Database error for user-2');
      }
      return Promise.resolve(MOCK_OLD_USER_SETTINGS);
    });

    (db.query.notificationPreferences.findFirst as any).mockResolvedValue(
      MOCK_OLD_NOTIFICATION_PREFERENCES
    );

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    const result = await batchMigrateHousehold(TEST_HOUSEHOLD_ID, userIds);

    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to migrate user user-2:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should return all failures if all migrations fail', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const userIds = ['user-1', 'user-2'];

    (db.query.userHouseholdPreferences.findFirst as any).mockResolvedValue(null);
    (db.query.userSettings.findFirst as any).mockRejectedValue(new Error('Database error'));

    const result = await batchMigrateHousehold(TEST_HOUSEHOLD_ID, userIds);

    expect(result.success).toBe(0);
    expect(result.failed).toBe(2);

    consoleErrorSpy.mockRestore();
  });

  it('should handle empty user list', async () => {
    const result = await batchMigrateHousehold(TEST_HOUSEHOLD_ID, []);

    expect(result.success).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('should skip users that already have preferences', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const userIds = ['user-1', 'user-2'];

    // User 1 already has preferences, user 2 does not
    (db.query.userHouseholdPreferences.findFirst as any)
      .mockResolvedValueOnce(MOCK_EXISTING_HOUSEHOLD_PREFERENCES) // user-1
      .mockResolvedValueOnce(null); // user-2

    (db.query.userSettings.findFirst as any).mockResolvedValue(MOCK_OLD_USER_SETTINGS);
    (db.query.notificationPreferences.findFirst as any).mockResolvedValue(
      MOCK_OLD_NOTIFICATION_PREFERENCES
    );

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    const result = await batchMigrateHousehold(TEST_HOUSEHOLD_ID, userIds);

    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockInsert).toHaveBeenCalledTimes(1); // Only user-2 migrated

    consoleLogSpy.mockRestore();
  });
});
