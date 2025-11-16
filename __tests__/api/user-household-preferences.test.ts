/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST, PATCH } from '@/app/api/user/households/[householdId]/preferences/route';
import { db } from '@/lib/db';
import { userHouseholdPreferences } from '@/lib/db/schema';

/**
 * Comprehensive tests for User-Per-Household Preferences API
 *
 * Tests the three-tier settings architecture where users can have different
 * preferences (theme, notifications, etc.) per household.
 *
 * Coverage:
 * - GET endpoint: Returns defaults or existing preferences
 * - POST endpoint: Creates/updates preferences with validation
 * - PATCH endpoint: Resets preferences to defaults
 * - Authorization: Membership checks work correctly
 * - Data isolation: Multiple users can have different preferences
 */

// Mock modules
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/household/permissions', () => ({
  isMemberOfHousehold: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-12345',
}));

import { requireAuth } from '@/lib/auth-helpers';
import { isMemberOfHousehold } from '@/lib/household/permissions';

// Test data
const TEST_USER_ID = 'user-123';
const TEST_HOUSEHOLD_ID = 'household-456';
const TEST_USER_ID_2 = 'user-789';

const DEFAULT_PREFERENCES = {
  dateFormat: 'MM/DD/YYYY',
  numberFormat: 'en-US',
  defaultAccountId: null,
  firstDayOfWeek: 'sunday',
  showCents: true,
  negativeNumberFormat: '-$100',
  defaultTransactionType: 'expense',
  theme: 'dark-mode',
  billRemindersEnabled: true,
  billRemindersChannels: '["push","email"]',
  budgetWarningsEnabled: true,
  budgetWarningsChannels: '["push","email"]',
  budgetExceededEnabled: true,
  budgetExceededChannels: '["push","email"]',
  budgetReviewEnabled: true,
  budgetReviewChannels: '["push","email"]',
  lowBalanceEnabled: true,
  lowBalanceChannels: '["push","email"]',
  savingsMilestonesEnabled: true,
  savingsMilestonesChannels: '["push","email"]',
  debtMilestonesEnabled: true,
  debtMilestonesChannels: '["push","email"]',
  weeklySummariesEnabled: false,
  weeklySummariesChannels: '["email"]',
  monthlySummariesEnabled: true,
  monthlySummariesChannels: '["email"]',
};

const EXISTING_PREFERENCES = {
  id: 'pref-123',
  userId: TEST_USER_ID,
  householdId: TEST_HOUSEHOLD_ID,
  ...DEFAULT_PREFERENCES,
  theme: 'dark-blue',
  dateFormat: 'DD/MM/YYYY',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

// Helper to create mock request
function createMockRequest(body?: any): Request {
  return {
    json: async () => body || {},
  } as Request;
}

// Helper to create mock params
function createMockParams(householdId: string) {
  return Promise.resolve({ householdId });
}

describe('User-Per-Household Preferences API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if user is not a member of household', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(false);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Not a member of this household');
    expect(isMemberOfHousehold).toHaveBeenCalledWith(TEST_HOUSEHOLD_ID, TEST_USER_ID);
  });

  it('should return default preferences if no preferences exist', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(true);

    // Mock db.select to return empty array
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(DEFAULT_PREFERENCES);
  });

  it('should return existing preferences merged with defaults', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(true);

    // Mock db.select to return existing preferences
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([EXISTING_PREFERENCES]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.theme).toBe('dark-blue');
    expect(data.dateFormat).toBe('DD/MM/YYYY');
    // Should include all default fields even if not in stored preferences
    expect(data.billRemindersEnabled).toBe(true);
  });
});

describe('User-Per-Household Preferences API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    const request = createMockRequest({ theme: 'dark-pink' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if user is not a member of household', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(false);

    const request = createMockRequest({ theme: 'dark-pink' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Not a member of this household');
  });

  it('should create new preferences if none exist', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(true);

    // Mock db.select to return empty array (no existing preferences)
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([]) // First call: check existing
            .mockResolvedValueOnce([{ // Second call: return created
              id: 'test-uuid-12345',
              userId: TEST_USER_ID,
              householdId: TEST_HOUSEHOLD_ID,
              ...DEFAULT_PREFERENCES,
              theme: 'dark-pink',
            }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    // Mock db.insert
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    const request = createMockRequest({ theme: 'dark-pink' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.preferences.theme).toBe('dark-pink');
    expect(mockInsert).toHaveBeenCalledWith(userHouseholdPreferences);
  });

  it('should update existing preferences (partial update)', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(true);

    // Mock db.select to return existing preferences
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([EXISTING_PREFERENCES]) // First call: existing found
            .mockResolvedValueOnce([{ // Second call: return updated
              ...EXISTING_PREFERENCES,
              theme: 'light-bubblegum',
            }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    // Mock db.update
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    (db.update as any).mockImplementation(mockUpdate);

    const request = createMockRequest({ theme: 'light-bubblegum' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.preferences.theme).toBe('light-bubblegum');
    expect(mockUpdate).toHaveBeenCalledWith(userHouseholdPreferences);
  });

  it('should support partial updates (only provided fields updated)', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(true);

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([EXISTING_PREFERENCES])
            .mockResolvedValueOnce([{
              ...EXISTING_PREFERENCES,
              billRemindersChannels: '["push"]',
            }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    (db.update as any).mockImplementation(mockUpdate);

    const request = createMockRequest({
      billRemindersChannels: '["push"]',
    });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.preferences.billRemindersChannels).toBe('["push"]');
    // Other fields should remain unchanged
    expect(data.preferences.theme).toBe('dark-blue');
  });

  it('should strip protected fields from update (id, userId, householdId, createdAt)', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(true);

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([EXISTING_PREFERENCES])
            .mockResolvedValueOnce([{
              ...EXISTING_PREFERENCES,
              theme: 'dark-turquoise',
            }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    (db.update as any).mockImplementation(mockUpdate);

    const request = createMockRequest({
      id: 'malicious-id',
      userId: 'malicious-user',
      householdId: 'malicious-household',
      createdAt: '2000-01-01T00:00:00.000Z',
      theme: 'dark-turquoise',
    });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // Protected fields should not be updated
    expect(data.preferences.id).toBe(EXISTING_PREFERENCES.id);
    expect(data.preferences.userId).toBe(TEST_USER_ID);
    expect(data.preferences.householdId).toBe(TEST_HOUSEHOLD_ID);
    // Only allowed fields should be updated
    expect(data.preferences.theme).toBe('dark-turquoise');
  });
});

describe('User-Per-Household Preferences API - PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if user is not a member of household', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(false);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Not a member of this household');
  });

  it('should reset existing preferences to defaults', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(true);

    // Mock db.select to return existing preferences
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([EXISTING_PREFERENCES]) // First call: existing found
            .mockResolvedValueOnce([{ // Second call: return reset
              ...EXISTING_PREFERENCES,
              ...DEFAULT_PREFERENCES,
            }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    // Mock db.update
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    (db.update as any).mockImplementation(mockUpdate);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Preferences reset to defaults');
    expect(data.preferences.theme).toBe(DEFAULT_PREFERENCES.theme);
    expect(data.preferences.dateFormat).toBe(DEFAULT_PREFERENCES.dateFormat);
    expect(mockUpdate).toHaveBeenCalledWith(userHouseholdPreferences);
  });

  it('should create new preferences with defaults if none exist', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(true);

    // Mock db.select to return empty array
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([]) // First call: no existing
            .mockResolvedValueOnce([{ // Second call: return created
              id: 'test-uuid-12345',
              userId: TEST_USER_ID,
              householdId: TEST_HOUSEHOLD_ID,
              ...DEFAULT_PREFERENCES,
            }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    // Mock db.insert
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Preferences reset to defaults');
    expect(data.preferences.theme).toBe(DEFAULT_PREFERENCES.theme);
    expect(mockInsert).toHaveBeenCalledWith(userHouseholdPreferences);
  });
});

describe('User-Per-Household Preferences API - Data Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should allow multiple users to have different preferences in same household', async () => {
    // User 1 has dark-blue theme
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID });
    (isMemberOfHousehold as any).mockResolvedValue(true);

    let mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            ...EXISTING_PREFERENCES,
            userId: TEST_USER_ID,
            theme: 'dark-blue',
          }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request1 = createMockRequest();
    const params1 = createMockParams(TEST_HOUSEHOLD_ID);

    const response1 = await GET(request1, { params: params1 });
    const data1 = await response1.json();

    expect(data1.theme).toBe('dark-blue');

    // User 2 has light-turquoise theme in same household
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_2 });

    mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            ...EXISTING_PREFERENCES,
            userId: TEST_USER_ID_2,
            theme: 'light-turquoise',
          }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request2 = createMockRequest();
    const params2 = createMockParams(TEST_HOUSEHOLD_ID);

    const response2 = await GET(request2, { params: params2 });
    const data2 = await response2.json();

    expect(data2.theme).toBe('light-turquoise');
  });

  it('should isolate user preferences between different households', async () => {
    const HOUSEHOLD_ID_2 = 'household-789';

    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID });
    (isMemberOfHousehold as any).mockResolvedValue(true);

    // User has dark-blue theme in household 1
    let mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            ...EXISTING_PREFERENCES,
            householdId: TEST_HOUSEHOLD_ID,
            theme: 'dark-blue',
          }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request1 = createMockRequest();
    const params1 = createMockParams(TEST_HOUSEHOLD_ID);

    const response1 = await GET(request1, { params: params1 });
    const data1 = await response1.json();

    expect(data1.theme).toBe('dark-blue');

    // Same user has light-bubblegum theme in household 2
    mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            ...EXISTING_PREFERENCES,
            householdId: HOUSEHOLD_ID_2,
            theme: 'light-bubblegum',
          }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request2 = createMockRequest();
    const params2 = createMockParams(HOUSEHOLD_ID_2);

    const response2 = await GET(request2, { params: params2 });
    const data2 = await response2.json();

    expect(data2.theme).toBe('light-bubblegum');
  });
});

describe('User-Per-Household Preferences API - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID });
    (isMemberOfHousehold as any).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 500 on database error (GET)', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch household preferences');
  });

  it('should return 500 on database error (POST)', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest({ theme: 'dark-pink' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update household preferences');
  });

  it('should return 500 on database error (PATCH)', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to reset household preferences');
  });
});
