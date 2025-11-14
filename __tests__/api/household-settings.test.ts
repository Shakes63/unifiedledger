import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST, PATCH } from '@/app/api/households/[householdId]/settings/route';
import { db } from '@/lib/db';
import { householdSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Comprehensive tests for Household Settings API
 *
 * Tests the household-wide settings shared by all members.
 * Only owners and admins can update settings, but all members can read them.
 *
 * Coverage:
 * - GET endpoint: Returns defaults or existing settings (all members)
 * - POST endpoint: Creates/updates settings with role check (owner/admin only)
 * - PATCH endpoint: Resets settings to defaults (owner/admin only)
 * - Authorization: Role-based permissions work correctly
 * - Data sharing: All members see same settings
 */

// Mock modules
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/household/permissions', () => ({
  isMemberOfHousehold: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-settings-123',
}));

import { requireAuth } from '@/lib/auth-helpers';
import { isMemberOfHousehold, hasPermission } from '@/lib/household/permissions';

// Test data
const TEST_USER_ID_OWNER = 'user-owner-123';
const TEST_USER_ID_ADMIN = 'user-admin-456';
const TEST_USER_ID_MEMBER = 'user-member-789';
const TEST_USER_ID_VIEWER = 'user-viewer-012';
const TEST_HOUSEHOLD_ID = 'household-456';

const DEFAULT_SETTINGS = {
  currency: 'USD',
  currencySymbol: '$',
  timeFormat: '12h',
  fiscalYearStart: 1,
  defaultBudgetMethod: 'monthly',
  budgetPeriod: 'monthly',
  autoCategorization: true,
  dataRetentionYears: 7,
  autoCleanupEnabled: false,
  cacheStrategy: 'normal',
};

const EXISTING_SETTINGS = {
  id: 'settings-123',
  householdId: TEST_HOUSEHOLD_ID,
  ...DEFAULT_SETTINGS,
  currency: 'EUR',
  currencySymbol: '€',
  fiscalYearStart: 4, // April
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

describe('Household Settings API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_OWNER });
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
    expect(isMemberOfHousehold).toHaveBeenCalledWith(TEST_HOUSEHOLD_ID, TEST_USER_ID_OWNER);
  });

  it('should return default settings if no settings exist', async () => {
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
    expect(data.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('should return existing settings merged with defaults', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(true);

    // Mock db.select to return existing settings
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([EXISTING_SETTINGS]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.settings.currency).toBe('EUR');
    expect(data.settings.currencySymbol).toBe('€');
    expect(data.settings.fiscalYearStart).toBe(4);
    // Should include all default fields even if not in stored settings
    expect(data.settings.autoCategorization).toBe(true);
  });

  it('should allow all members (owner/admin/member/viewer) to read settings', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(true);

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([EXISTING_SETTINGS]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    // Test as viewer (lowest permission level)
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_VIEWER });

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.settings).toBeDefined();
    // GET should not check hasPermission, only isMemberOfHousehold
    expect(hasPermission).not.toHaveBeenCalled();
  });
});

describe('Household Settings API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_OWNER });
    (isMemberOfHousehold as any).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    const request = createMockRequest({ currency: 'GBP' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if user is not a member of household', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(false);

    const request = createMockRequest({ currency: 'GBP' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Not a member of this household');
  });

  it('should return 403 if user is a member but not owner/admin', async () => {
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_MEMBER });
    (hasPermission as any).mockResolvedValue(false);

    const request = createMockRequest({ currency: 'GBP' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Only household owners and admins can update household settings');
    expect(hasPermission).toHaveBeenCalledWith(TEST_HOUSEHOLD_ID, TEST_USER_ID_MEMBER, 'manage_permissions');
  });

  it('should return 403 if user is a viewer', async () => {
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_VIEWER });
    (hasPermission as any).mockResolvedValue(false);

    const request = createMockRequest({ currency: 'GBP' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Only household owners and admins can update household settings');
  });

  it('should allow owner to create new settings', async () => {
    (hasPermission as any).mockResolvedValue(true);

    // Mock db.select to return empty array (no existing settings)
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([]) // First call: check existing
            .mockResolvedValueOnce([{ // Second call: return created
              id: 'test-uuid-settings-123',
              householdId: TEST_HOUSEHOLD_ID,
              ...DEFAULT_SETTINGS,
              currency: 'GBP',
              currencySymbol: '£',
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

    const request = createMockRequest({ currency: 'GBP', currencySymbol: '£' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.settings.currency).toBe('GBP');
    expect(data.settings.currencySymbol).toBe('£');
    expect(mockInsert).toHaveBeenCalledWith(householdSettings);
  });

  it('should allow admin to update existing settings', async () => {
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_ADMIN });
    (hasPermission as any).mockResolvedValue(true);

    // Mock db.select to return existing settings
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([EXISTING_SETTINGS]) // First call: existing found
            .mockResolvedValueOnce([{ // Second call: return updated
              ...EXISTING_SETTINGS,
              fiscalYearStart: 7, // July
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

    const request = createMockRequest({ fiscalYearStart: 7 });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.settings.fiscalYearStart).toBe(7);
    expect(mockUpdate).toHaveBeenCalledWith(householdSettings);
  });

  it('should support partial updates (only provided fields updated)', async () => {
    (hasPermission as any).mockResolvedValue(true);

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([EXISTING_SETTINGS])
            .mockResolvedValueOnce([{
              ...EXISTING_SETTINGS,
              autoCategorization: false,
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
      autoCategorization: false,
    });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.settings.autoCategorization).toBe(false);
    // Other fields should remain unchanged
    expect(data.settings.currency).toBe('EUR');
  });

  it('should strip protected fields from update (id, householdId, createdAt)', async () => {
    (hasPermission as any).mockResolvedValue(true);

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([EXISTING_SETTINGS])
            .mockResolvedValueOnce([{
              ...EXISTING_SETTINGS,
              dataRetentionYears: 10,
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
      householdId: 'malicious-household',
      createdAt: '2000-01-01T00:00:00.000Z',
      dataRetentionYears: 10,
    });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // Protected fields should not be updated
    expect(data.settings.id).toBe(EXISTING_SETTINGS.id);
    expect(data.settings.householdId).toBe(TEST_HOUSEHOLD_ID);
    // Only allowed fields should be updated
    expect(data.settings.dataRetentionYears).toBe(10);
  });
});

describe('Household Settings API - PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_OWNER });
    (isMemberOfHousehold as any).mockResolvedValue(true);
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

  it('should return 403 if user is not owner/admin', async () => {
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_MEMBER });
    (hasPermission as any).mockResolvedValue(false);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Only household owners and admins can reset household settings');
  });

  it('should allow owner to reset existing settings to defaults', async () => {
    (hasPermission as any).mockResolvedValue(true);

    // Mock db.select to return existing settings
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([EXISTING_SETTINGS]) // First call: existing found
            .mockResolvedValueOnce([{ // Second call: return reset
              ...EXISTING_SETTINGS,
              ...DEFAULT_SETTINGS,
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
    expect(data.message).toBe('Household settings reset to defaults');
    expect(data.settings.currency).toBe(DEFAULT_SETTINGS.currency);
    expect(data.settings.fiscalYearStart).toBe(DEFAULT_SETTINGS.fiscalYearStart);
    expect(mockUpdate).toHaveBeenCalledWith(householdSettings);
  });

  it('should allow admin to reset settings', async () => {
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_ADMIN });
    (hasPermission as any).mockResolvedValue(true);

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([EXISTING_SETTINGS])
            .mockResolvedValueOnce([{
              ...EXISTING_SETTINGS,
              ...DEFAULT_SETTINGS,
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

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Household settings reset to defaults');
  });

  it('should create new settings with defaults if none exist', async () => {
    (hasPermission as any).mockResolvedValue(true);

    // Mock db.select to return empty array
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn()
            .mockResolvedValueOnce([]) // First call: no existing
            .mockResolvedValueOnce([{ // Second call: return created
              id: 'test-uuid-settings-123',
              householdId: TEST_HOUSEHOLD_ID,
              ...DEFAULT_SETTINGS,
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
    expect(data.message).toBe('Household settings reset to defaults');
    expect(data.settings.currency).toBe(DEFAULT_SETTINGS.currency);
    expect(mockInsert).toHaveBeenCalledWith(householdSettings);
  });
});

describe('Household Settings API - Data Sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isMemberOfHousehold as any).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show same settings to all household members', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([EXISTING_SETTINGS]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    // Owner reads settings
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_OWNER });
    const request1 = createMockRequest();
    const params1 = createMockParams(TEST_HOUSEHOLD_ID);
    const response1 = await GET(request1, { params: params1 });
    const data1 = await response1.json();

    // Member reads same settings
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_MEMBER });
    const request2 = createMockRequest();
    const params2 = createMockParams(TEST_HOUSEHOLD_ID);
    const response2 = await GET(request2, { params: params2 });
    const data2 = await response2.json();

    // Viewer reads same settings
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_VIEWER });
    const request3 = createMockRequest();
    const params3 = createMockParams(TEST_HOUSEHOLD_ID);
    const response3 = await GET(request3, { params: params3 });
    const data3 = await response3.json();

    // All should see identical settings
    expect(data1.settings).toEqual(data2.settings);
    expect(data2.settings).toEqual(data3.settings);
    expect(data1.settings.currency).toBe('EUR');
  });

  it('should isolate settings between different households', async () => {
    const HOUSEHOLD_ID_2 = 'household-789';

    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_OWNER });

    // Household 1 has EUR currency
    let mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            ...EXISTING_SETTINGS,
            householdId: TEST_HOUSEHOLD_ID,
            currency: 'EUR',
          }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request1 = createMockRequest();
    const params1 = createMockParams(TEST_HOUSEHOLD_ID);
    const response1 = await GET(request1, { params: params1 });
    const data1 = await response1.json();

    expect(data1.settings.currency).toBe('EUR');

    // Household 2 has GBP currency
    mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            ...EXISTING_SETTINGS,
            householdId: HOUSEHOLD_ID_2,
            currency: 'GBP',
          }]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request2 = createMockRequest();
    const params2 = createMockParams(HOUSEHOLD_ID_2);
    const response2 = await GET(request2, { params: params2 });
    const data2 = await response2.json();

    expect(data2.settings.currency).toBe('GBP');
  });
});

describe('Household Settings API - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_OWNER });
    (isMemberOfHousehold as any).mockResolvedValue(true);
    (hasPermission as any).mockResolvedValue(true);
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
    expect(data.error).toBe('Failed to fetch household settings');
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

    const request = createMockRequest({ currency: 'GBP' });
    const params = createMockParams(TEST_HOUSEHOLD_ID);

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update household settings');
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
    expect(data.error).toBe('Failed to reset household settings');
  });
});
