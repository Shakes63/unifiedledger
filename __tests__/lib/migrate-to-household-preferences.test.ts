/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Comprehensive tests for Migration Helper Utilities
 *
 * Tests the migration from old user_settings/notification_preferences tables
 * to the new user_household_preferences table.
 */

// Mock modules - Use chainable select/from/where pattern that matches actual implementation
// Note: vi.mock is hoisted, so we need to access mocks via the imported module
vi.mock('@/lib/db', () => {
  const mockLimit = vi.fn().mockResolvedValue([]);
  const mockValues = vi.fn().mockResolvedValue(undefined);
  
  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: mockLimit,
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: mockValues,
      }),
      // Expose mocks for test access
      __mockLimit: mockLimit,
      __mockValues: mockValues,
    },
  };
});

vi.mock('@/lib/db/schema', () => ({
  userHouseholdPreferences: { name: 'userHouseholdPreferences' },
  userSettings: { name: 'userSettings' },
  notificationPreferences: { name: 'notificationPreferences' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value })),
  and: vi.fn((...conditions) => ({ conditions })),
}));

vi.mock('uuid', () => ({
  v4: () => 'test-migration-uuid-123',
}));

// Import after mocks are set up
import {
  hasHouseholdPreferences,
  migrateUserPreferences,
  getOrMigratePreferences,
  batchMigrateHousehold,
} from '@/lib/migrations/migrate-to-household-preferences';
import { db } from '@/lib/db';

// Get references to the mock functions
const mockLimitFn = (db as any).__mockLimit;
const mockValuesFn = (db as any).__mockValues;

// Test data
const TEST_USER_ID = 'user-123';
const TEST_HOUSEHOLD_ID = 'household-456';

const MOCK_EXISTING_HOUSEHOLD_PREFERENCES = {
  id: 'pref-123',
  userId: TEST_USER_ID,
  householdId: TEST_HOUSEHOLD_ID,
  dateFormat: 'MM/DD/YYYY',
  theme: 'dark-mode',
  billRemindersEnabled: true,
  billRemindersChannels: '["push"]',
};

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
  savingsMilestoneEnabled: false,
  savingsMilestoneChannels: '["push"]',
  debtMilestoneEnabled: true,
  debtMilestoneChannels: '["email"]',
  weeklySummaryEnabled: true,
  weeklySummaryChannels: '["email"]',
  monthlySummaryEnabled: false,
  monthlySummaryChannels: '["push"]',
};

describe('Migration Helper - hasHouseholdPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimitFn.mockReset();
    mockValuesFn.mockReset();
    mockLimitFn.mockResolvedValue([]);
    mockValuesFn.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return true if preferences exist', async () => {
    mockLimitFn.mockResolvedValueOnce([MOCK_EXISTING_HOUSEHOLD_PREFERENCES]);

    const result = await hasHouseholdPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(result).toBe(true);
  });

  it('should return false if preferences do not exist', async () => {
    mockLimitFn.mockResolvedValueOnce([]);

    const result = await hasHouseholdPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(result).toBe(false);
  });

  it('should return false on database error (graceful degradation)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLimitFn.mockRejectedValueOnce(new Error('Database error'));

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
    mockLimitFn.mockReset();
    mockValuesFn.mockReset();
    mockLimitFn.mockResolvedValue([]);
    mockValuesFn.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should skip migration if preferences already exist', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Return existing preferences on first query
    mockLimitFn.mockResolvedValueOnce([MOCK_EXISTING_HOUSEHOLD_PREFERENCES]);

    await migrateUserPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Preferences already exist for user ${TEST_USER_ID} in household ${TEST_HOUSEHOLD_ID}`
    );
    // Insert should not be called
    expect(mockValuesFn).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  it('should migrate user settings and notification preferences', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // First query: check existing preferences (none)
    mockLimitFn
      .mockResolvedValueOnce([]) // hasHouseholdPreferences returns empty
      .mockResolvedValueOnce([MOCK_OLD_USER_SETTINGS]) // userSettings query
      .mockResolvedValueOnce([MOCK_OLD_NOTIFICATION_PREFERENCES]); // notificationPreferences query

    await migrateUserPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(mockValuesFn).toHaveBeenCalled();
    const insertedValues = mockValuesFn.mock.calls[0][0];

    // Verify migrated preferences
    expect(insertedValues.userId).toBe(TEST_USER_ID);
    expect(insertedValues.householdId).toBe(TEST_HOUSEHOLD_ID);
    expect(insertedValues.dateFormat).toBe('DD/MM/YYYY');
    expect(insertedValues.numberFormat).toBe('en-GB');
    expect(insertedValues.theme).toBe('dark-blue');
    expect(insertedValues.showCents).toBe(false);
    expect(insertedValues.billRemindersEnabled).toBe(true);
    expect(insertedValues.billRemindersChannels).toBe('["push","email"]');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Successfully migrated preferences for user ${TEST_USER_ID} to household ${TEST_HOUSEHOLD_ID}`
    );

    consoleLogSpy.mockRestore();
  });

  it('should use defaults when old settings are missing', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockLimitFn
      .mockResolvedValueOnce([]) // hasHouseholdPreferences
      .mockResolvedValueOnce([]) // userSettings (empty)
      .mockResolvedValueOnce([]); // notificationPreferences (empty)

    await migrateUserPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    const insertedValues = mockValuesFn.mock.calls[0][0];

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

    mockLimitFn
      .mockResolvedValueOnce([]) // hasHouseholdPreferences
      .mockResolvedValueOnce([{ theme: 'light-bubblegum' }]) // Partial userSettings
      .mockResolvedValueOnce([{ billReminderEnabled: false }]); // Partial notifications

    await migrateUserPreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    const insertedValues = mockValuesFn.mock.calls[0][0];

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

    mockLimitFn
      .mockResolvedValueOnce([]) // hasHouseholdPreferences
      .mockRejectedValueOnce(new Error('Database error')); // userSettings fails

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
    mockLimitFn.mockReset();
    mockValuesFn.mockReset();
    mockLimitFn.mockResolvedValue([]);
    mockValuesFn.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return existing preferences without migration', async () => {
    mockLimitFn.mockResolvedValueOnce([MOCK_EXISTING_HOUSEHOLD_PREFERENCES]);

    const result = await getOrMigratePreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(result).toEqual(MOCK_EXISTING_HOUSEHOLD_PREFERENCES);
    expect(mockValuesFn).not.toHaveBeenCalled(); // No migration needed
  });

  it('should auto-migrate if preferences do not exist', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // First query: no existing preferences
    // Then migration queries, then final query returns the new preferences
    mockLimitFn
      .mockResolvedValueOnce([]) // getOrMigratePreferences first check
      .mockResolvedValueOnce([]) // hasHouseholdPreferences in migrateUserPreferences
      .mockResolvedValueOnce([MOCK_OLD_USER_SETTINGS]) // userSettings
      .mockResolvedValueOnce([MOCK_OLD_NOTIFICATION_PREFERENCES]) // notificationPreferences
      .mockResolvedValueOnce([MOCK_EXISTING_HOUSEHOLD_PREFERENCES]); // Final fetch after insert

    const result = await getOrMigratePreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `No preferences found for user ${TEST_USER_ID} in household ${TEST_HOUSEHOLD_ID}, migrating...`
    );
    expect(mockValuesFn).toHaveBeenCalled();
    expect(result).toEqual(MOCK_EXISTING_HOUSEHOLD_PREFERENCES);

    consoleLogSpy.mockRestore();
  });

  it('should throw error if migration fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockLimitFn
      .mockResolvedValueOnce([]) // getOrMigratePreferences first check
      .mockResolvedValueOnce([]) // hasHouseholdPreferences
      .mockRejectedValueOnce(new Error('Migration failed')); // userSettings fails

    await expect(getOrMigratePreferences(TEST_USER_ID, TEST_HOUSEHOLD_ID)).rejects.toThrow();

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should throw error if preferences still not found after migration', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Migration completes but preferences still not found
    mockLimitFn
      .mockResolvedValueOnce([]) // getOrMigratePreferences first check
      .mockResolvedValueOnce([]) // hasHouseholdPreferences
      .mockResolvedValueOnce([MOCK_OLD_USER_SETTINGS])
      .mockResolvedValueOnce([MOCK_OLD_NOTIFICATION_PREFERENCES])
      .mockResolvedValueOnce([]); // Still empty after migration

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
    mockLimitFn.mockReset();
    mockValuesFn.mockReset();
    mockLimitFn.mockResolvedValue([]);
    mockValuesFn.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should migrate all users successfully', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const userIds = ['user-1', 'user-2', 'user-3'];

    // For each user: hasHouseholdPreferences (empty), userSettings, notificationPreferences
    for (let i = 0; i < userIds.length; i++) {
      mockLimitFn
        .mockResolvedValueOnce([]) // hasHouseholdPreferences
        .mockResolvedValueOnce([MOCK_OLD_USER_SETTINGS])
        .mockResolvedValueOnce([MOCK_OLD_NOTIFICATION_PREFERENCES]);
    }

    const result = await batchMigrateHousehold(TEST_HOUSEHOLD_ID, userIds);

    expect(result.success).toBe(3);
    expect(result.failed).toBe(0);
    expect(mockValuesFn).toHaveBeenCalledTimes(3);

    consoleLogSpy.mockRestore();
  });

  it('should handle partial failures gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const userIds = ['user-1', 'user-2', 'user-3'];

    // User 1 succeeds
    mockLimitFn
      .mockResolvedValueOnce([]) // hasHouseholdPreferences
      .mockResolvedValueOnce([MOCK_OLD_USER_SETTINGS])
      .mockResolvedValueOnce([MOCK_OLD_NOTIFICATION_PREFERENCES]);
    
    // User 2 fails
    mockLimitFn
      .mockResolvedValueOnce([]) // hasHouseholdPreferences
      .mockRejectedValueOnce(new Error('Database error for user-2'));
    
    // User 3 succeeds
    mockLimitFn
      .mockResolvedValueOnce([]) // hasHouseholdPreferences
      .mockResolvedValueOnce([MOCK_OLD_USER_SETTINGS])
      .mockResolvedValueOnce([MOCK_OLD_NOTIFICATION_PREFERENCES]);

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

    // Both users fail
    mockLimitFn
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Database error'))
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Database error'));

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

    // User 1 already has preferences
    mockLimitFn.mockResolvedValueOnce([MOCK_EXISTING_HOUSEHOLD_PREFERENCES]);
    
    // User 2 needs migration
    mockLimitFn
      .mockResolvedValueOnce([]) // hasHouseholdPreferences
      .mockResolvedValueOnce([MOCK_OLD_USER_SETTINGS])
      .mockResolvedValueOnce([MOCK_OLD_NOTIFICATION_PREFERENCES]);

    const result = await batchMigrateHousehold(TEST_HOUSEHOLD_ID, userIds);

    expect(result.success).toBe(2); // Both counted as success
    expect(result.failed).toBe(0);
    expect(mockValuesFn).toHaveBeenCalledTimes(1); // Only user-2 actually inserted

    consoleLogSpy.mockRestore();
  });
});
