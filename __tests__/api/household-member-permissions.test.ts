/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, PUT, DELETE } from '@/app/api/households/[householdId]/members/[memberId]/permissions/route';
import { db } from '@/lib/db';

/**
 * Comprehensive integration tests for Household Member Permissions API
 *
 * Tests the permission management endpoints for household members.
 * Only users with manage_permissions can update permissions, but all members can view them.
 *
 * Coverage:
 * - GET endpoint: Returns permissions for member (any household member can view)
 * - PUT endpoint: Updates custom permissions with authorization and validation
 * - DELETE endpoint: Resets custom permissions to role defaults
 * - Authorization: Permission checks work correctly
 * - Validation: Owner protection, last admin protection, permission name validation
 */

// Mock modules
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/household/permissions', () => ({
  hasPermission: vi.fn(),
  isMemberOfHousehold: vi.fn(),
  getEffectivePermissions: vi.fn(),
  validatePermissionChange: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import {
  hasPermission,
  isMemberOfHousehold,
  getEffectivePermissions,
  validatePermissionChange,
} from '@/lib/household/permissions';

// Test data
const _TEST_USER_ID_OWNER = 'user-owner-123';
const TEST_USER_ID_ADMIN = 'user-admin-456';
const _TEST_USER_ID_MEMBER = 'user-member-789';
const TEST_USER_ID_VIEWER = 'user-viewer-012';
const _TEST_USER_ID_NON_MEMBER = 'user-non-member-999';
const TEST_HOUSEHOLD_ID = 'household-456';
const TEST_MEMBER_ID = 'member-123';
const TEST_TARGET_USER_ID = 'target-user-999';

const MOCK_MEMBER = {
  id: TEST_MEMBER_ID,
  householdId: TEST_HOUSEHOLD_ID,
  userId: TEST_TARGET_USER_ID,
  role: 'admin',
  customPermissions: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const MOCK_EFFECTIVE_PERMISSIONS = {
  role: 'admin',
  rolePermissions: {
    invite_members: true,
    remove_members: true,
    manage_permissions: true,
    create_accounts: true,
    edit_accounts: true,
    delete_accounts: false,
    create_transactions: true,
    edit_all_transactions: true,
    view_all_data: true,
    manage_budget: true,
    delete_household: false,
    leave_household: true,
  },
  customPermissions: null,
  effectivePermissions: {
    invite_members: true,
    remove_members: true,
    manage_permissions: true,
    create_accounts: true,
    edit_accounts: true,
    delete_accounts: false,
    create_transactions: true,
    edit_all_transactions: true,
    view_all_data: true,
    manage_budget: true,
    delete_household: false,
    leave_household: true,
  },
};

// Helper to create mock request
function createMockRequest(body?: any): Request {
  return {
    json: async () => body || {},
  } as Request;
}

// Helper to create mock params
function createMockParams(householdId: string, memberId: string) {
  return Promise.resolve({ householdId, memberId });
}

describe('Household Member Permissions API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_ADMIN });
    (isMemberOfHousehold as any).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if user is not a member of household', async () => {
    (isMemberOfHousehold as any).mockResolvedValue(false);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Not a member of this household');
  });

  it('should return 404 if member not found', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Member not found');
  });

  it('should return 400 if member belongs to different household', async () => {
    const mockMember = { ...MOCK_MEMBER, householdId: 'different-household' };
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockMember]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Member does not belong to this household');
  });

  it('should return permissions for member (any household member can view)', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([MOCK_MEMBER]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);
    (getEffectivePermissions as any).mockResolvedValue(MOCK_EFFECTIVE_PERMISSIONS);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(MOCK_EFFECTIVE_PERMISSIONS);
    expect(getEffectivePermissions).toHaveBeenCalledWith(
      TEST_HOUSEHOLD_ID,
      TEST_TARGET_USER_ID
    );
  });

  it('should allow viewer to view permissions', async () => {
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_VIEWER });

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([MOCK_MEMBER]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);
    (getEffectivePermissions as any).mockResolvedValue(MOCK_EFFECTIVE_PERMISSIONS);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(MOCK_EFFECTIVE_PERMISSIONS);
    // GET should not check hasPermission, only isMemberOfHousehold
    expect(hasPermission).not.toHaveBeenCalled();
  });
});

describe('Household Member Permissions API - PUT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_ADMIN });
    (hasPermission as any).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    const request = createMockRequest({ permissions: { create_accounts: false } });
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if requester lacks manage_permissions', async () => {
    (hasPermission as any).mockResolvedValue(false);

    const request = createMockRequest({ permissions: { create_accounts: false } });
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Not authorized to manage permissions');
    expect(hasPermission).toHaveBeenCalledWith(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      'manage_permissions'
    );
  });

  it('should return 400 if permissions object is invalid', async () => {
    const request = createMockRequest({ permissions: 'invalid' });
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid permissions object');
  });

  it('should return 400 if permissions object is missing', async () => {
    const request = createMockRequest({});
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid permissions object');
  });

  it('should return 404 if member not found', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest({ permissions: { create_accounts: false } });
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Member not found');
  });

  it('should return 400 if validation fails (owner protection)', async () => {
    const mockOwnerMember = { ...MOCK_MEMBER, role: 'owner' };
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockOwnerMember]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);
    (validatePermissionChange as any).mockResolvedValue({
      isValid: false,
      error: 'Cannot modify permissions for owners',
    });

    const request = createMockRequest({ permissions: { create_accounts: false } });
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Cannot modify permissions for owners');
  });

  it('should return 400 if validation fails (last admin protection)', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([MOCK_MEMBER]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);
    (validatePermissionChange as any).mockResolvedValue({
      isValid: false,
      error: 'Cannot remove manage_permissions from the last admin',
    });

    const request = createMockRequest({ permissions: { manage_permissions: false } });
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Cannot remove manage_permissions from the last admin');
  });

  it('should return 400 if validation fails (invalid permission name)', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([MOCK_MEMBER]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);
    (validatePermissionChange as any).mockResolvedValue({
      isValid: false,
      error: 'Invalid permission: invalid_permission',
    });

    const request = createMockRequest({ permissions: { invalid_permission: true } });
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid permission: invalid_permission');
  });

  it('should successfully update custom permissions', async () => {
    const customPerms = { create_accounts: false };
    const updatedPermissions = {
      ...MOCK_EFFECTIVE_PERMISSIONS,
      customPermissions: customPerms,
      effectivePermissions: {
        ...MOCK_EFFECTIVE_PERMISSIONS.effectivePermissions,
        create_accounts: false,
      },
    };

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([MOCK_MEMBER]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);
    (validatePermissionChange as any).mockResolvedValue({ isValid: true });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...MOCK_MEMBER, customPermissions: JSON.stringify(customPerms) }]),
        }),
      }),
    });
    (db.update as any).mockImplementation(mockUpdate);
    (getEffectivePermissions as any).mockResolvedValue(updatedPermissions);

    const request = createMockRequest({ permissions: customPerms });
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(updatedPermissions);
    expect(validatePermissionChange).toHaveBeenCalledWith(
      TEST_HOUSEHOLD_ID,
      TEST_TARGET_USER_ID,
      customPerms
    );
  });

  it('should set customPermissions to null for empty object', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([MOCK_MEMBER]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);
    (validatePermissionChange as any).mockResolvedValue({ isValid: true });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...MOCK_MEMBER, customPermissions: null }]),
        }),
      }),
    });
    (db.update as any).mockImplementation(mockUpdate);
    (getEffectivePermissions as any).mockResolvedValue(MOCK_EFFECTIVE_PERMISSIONS);

    const request = createMockRequest({ permissions: {} });
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(MOCK_EFFECTIVE_PERMISSIONS);
  });
});

describe('Household Member Permissions API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID_ADMIN });
    (hasPermission as any).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if requester lacks manage_permissions', async () => {
    (hasPermission as any).mockResolvedValue(false);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Not authorized to manage permissions');
  });

  it('should return 404 if member not found', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Member not found');
  });

  it('should return 400 if attempting to reset owner permissions', async () => {
    const mockOwnerMember = { ...MOCK_MEMBER, role: 'owner' };
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockOwnerMember]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Cannot reset permissions for owners');
  });

  it('should successfully reset custom permissions to null', async () => {
    const memberWithCustomPerms = {
      ...MOCK_MEMBER,
      customPermissions: JSON.stringify({ create_accounts: false }),
    };

    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([memberWithCustomPerms]),
        }),
      }),
    });
    (db.select as any).mockImplementation(mockSelect);

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...MOCK_MEMBER, customPermissions: null }]),
        }),
      }),
    });
    (db.update as any).mockImplementation(mockUpdate);
    (getEffectivePermissions as any).mockResolvedValue(MOCK_EFFECTIVE_PERMISSIONS);

    const request = createMockRequest();
    const params = createMockParams(TEST_HOUSEHOLD_ID, TEST_MEMBER_ID);

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(MOCK_EFFECTIVE_PERMISSIONS);
    expect(data.customPermissions).toBeNull();
  });
});

