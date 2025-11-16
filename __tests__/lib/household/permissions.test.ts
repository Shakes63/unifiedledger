/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUserHouseholdRole,
  hasPermission,
  getEffectivePermissions,
  getUserPermissions,
  isMemberOfHousehold,
  validatePermissionChange,
  PERMISSIONS,
  type HouseholdRole,
  type HouseholdPermission,
  type CustomPermissions,
} from '@/lib/household/permissions';
import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';

/**
 * Comprehensive unit tests for Permission Resolution Logic
 *
 * Tests the core permission system including:
 * - Role-based permissions
 * - Custom permission overrides
 * - Permission resolution (custom overrides role defaults)
 * - Deny precedence (custom false overrides role true)
 * - Owner protection (owners always have all permissions)
 * - Last admin protection (cannot remove manage_permissions from last admin)
 *
 * Coverage:
 * - getUserHouseholdRole() - Role retrieval
 * - hasPermission() - Permission checking with custom overrides
 * - getEffectivePermissions() - Complete permission calculation
 * - getUserPermissions() - Effective permissions retrieval
 * - isMemberOfHousehold() - Membership checking
 * - validatePermissionChange() - Permission change validation
 */

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

// Test data
const TEST_USER_ID_OWNER = 'user-owner-123';
const TEST_USER_ID_ADMIN = 'user-admin-456';
const TEST_USER_ID_MEMBER = 'user-member-789';
const TEST_USER_ID_VIEWER = 'user-viewer-012';
const TEST_USER_ID_NON_MEMBER = 'user-non-member-999';
const TEST_HOUSEHOLD_ID = 'household-456';
const TEST_HOUSEHOLD_ID_SINGLE_ADMIN = 'household-single-admin-789';

// Mock database query builder
function createMockQueryBuilder(mockData: any[]) {
  const builder = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  
  // Chain methods properly - each returns the builder
  builder.select.mockReturnValue(builder);
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.limit.mockResolvedValue(mockData);
  
  return builder;
}

describe('Permission Resolution Logic - getUserHouseholdRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return correct role for existing member', async () => {
    const mockMember = [{ role: 'admin' }];
    (db.select as any).mockReturnValue(createMockQueryBuilder(mockMember));

    const role = await getUserHouseholdRole(TEST_HOUSEHOLD_ID, TEST_USER_ID_ADMIN);
    expect(role).toBe('admin');
  });

  it('should return null for non-member', async () => {
    const mockMember: any[] = [];
    (db.select as any).mockReturnValue(createMockQueryBuilder(mockMember));

    const role = await getUserHouseholdRole(TEST_HOUSEHOLD_ID, TEST_USER_ID_NON_MEMBER);
    expect(role).toBeNull();
  });

  it('should handle different roles correctly', async () => {
    const roles: HouseholdRole[] = ['owner', 'admin', 'member', 'viewer'];
    
    for (const role of roles) {
      const mockMember = [{ role }];
      (db.select as any).mockReturnValue(createMockQueryBuilder(mockMember));

      const result = await getUserHouseholdRole(TEST_HOUSEHOLD_ID, TEST_USER_ID_ADMIN);
      expect(result).toBe(role);
    }
  });
});

describe('Permission Resolution Logic - hasPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return true for role-based permission when no custom override', async () => {
    // Admin has create_accounts by default
    const mockRoleMember = [{ role: 'admin' }];
    const mockCustomMember: any[] = []; // No custom permissions
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await hasPermission(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      'create_accounts'
    );
    expect(result).toBe(true);
  });

  it('should return false for denied role-based permission when no custom override', async () => {
    // Admin does not have delete_accounts by default
    const mockRoleMember = [{ role: 'admin' }];
    const mockCustomMember: any[] = []; // No custom permissions
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await hasPermission(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      'delete_accounts'
    );
    expect(result).toBe(false);
  });

  it('should return true when custom permission override is true', async () => {
    // Member does not have create_accounts by default, but custom override grants it
    const mockRoleMember = [{ role: 'member' }];
    const mockCustomMember = [{ customPermissions: JSON.stringify({ create_accounts: true }) }];
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await hasPermission(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_MEMBER,
      'create_accounts'
    );
    expect(result).toBe(true);
  });

  it('should return false when custom permission override is false (deny precedence)', async () => {
    // Admin has create_accounts by default, but custom override denies it
    const mockRoleMember = [{ role: 'admin' }];
    const mockCustomMember = [{ customPermissions: JSON.stringify({ create_accounts: false }) }];
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await hasPermission(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      'create_accounts'
    );
    expect(result).toBe(false);
  });

  it('should always return true for owners (all permissions)', async () => {
    const mockRoleMember = [{ role: 'owner' }];
    
    (db.select as any).mockReturnValue(createMockQueryBuilder(mockRoleMember));

    // Test all permissions for owner
    const allPermissions: HouseholdPermission[] = [
      'invite_members',
      'remove_members',
      'manage_permissions',
      'create_accounts',
      'edit_accounts',
      'delete_accounts',
      'create_transactions',
      'edit_all_transactions',
      'view_all_data',
      'manage_budget',
      'delete_household',
    ];

    for (const permission of allPermissions) {
      const result = await hasPermission(
        TEST_HOUSEHOLD_ID,
        TEST_USER_ID_OWNER,
        permission
      );
      expect(result).toBe(true);
    }
  });

  it('should return false for non-member', async () => {
    const mockMember: any[] = [];
    (db.select as any).mockReturnValue(createMockQueryBuilder(mockMember));

    const result = await hasPermission(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_NON_MEMBER,
      'create_accounts'
    );
    expect(result).toBe(false);
  });

  it('should handle invalid JSON in custom permissions gracefully', async () => {
    const mockRoleMember = [{ role: 'admin' }];
    const mockCustomMember = [{ customPermissions: 'invalid-json' }];
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    // Should fall back to role-based permissions
    const result = await hasPermission(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      'create_accounts'
    );
    expect(result).toBe(true); // Admin has create_accounts by default
  });

  it('should handle null custom permissions', async () => {
    const mockRoleMember = [{ role: 'admin' }];
    const mockCustomMember = [{ customPermissions: null }];
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await hasPermission(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      'create_accounts'
    );
    expect(result).toBe(true); // Falls back to role-based
  });
});

describe('Permission Resolution Logic - getEffectivePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return correct structure with all fields', async () => {
    const mockRoleMember = [{ role: 'admin' }];
    const mockCustomMember: any[] = [];
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await getEffectivePermissions(TEST_HOUSEHOLD_ID, TEST_USER_ID_ADMIN);
    
    expect(result).toHaveProperty('role');
    expect(result).toHaveProperty('rolePermissions');
    expect(result).toHaveProperty('customPermissions');
    expect(result).toHaveProperty('effectivePermissions');
  });

  it('should return role permissions matching role defaults', async () => {
    const mockRoleMember = [{ role: 'admin' }];
    const mockCustomMember: any[] = [];
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await getEffectivePermissions(TEST_HOUSEHOLD_ID, TEST_USER_ID_ADMIN);
    
    expect(result.role).toBe('admin');
    expect(result.rolePermissions).toEqual(PERMISSIONS.admin);
    expect(result.customPermissions).toBeNull();
    expect(result.effectivePermissions).toEqual(PERMISSIONS.admin);
  });

  it('should apply custom permissions override to role defaults', async () => {
    const mockRoleMember = [{ role: 'admin' }];
    const customPerms: CustomPermissions = { create_accounts: false };
    const mockCustomMember = [{ customPermissions: JSON.stringify(customPerms) }];
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await getEffectivePermissions(TEST_HOUSEHOLD_ID, TEST_USER_ID_ADMIN);
    
    expect(result.role).toBe('admin');
    expect(result.rolePermissions).toEqual(PERMISSIONS.admin);
    expect(result.customPermissions).toEqual(customPerms);
    expect(result.effectivePermissions?.create_accounts).toBe(false); // Overridden
    expect(result.effectivePermissions?.edit_accounts).toBe(true); // Not overridden
  });

  it('should enforce deny precedence (custom false overrides role true)', async () => {
    const mockRoleMember = [{ role: 'admin' }];
    const customPerms: CustomPermissions = { invite_members: false };
    const mockCustomMember = [{ customPermissions: JSON.stringify(customPerms) }];
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await getEffectivePermissions(TEST_HOUSEHOLD_ID, TEST_USER_ID_ADMIN);
    
    // Admin has invite_members by default, but custom override denies it
    expect(result.effectivePermissions?.invite_members).toBe(false);
  });

  it('should return null for non-member', async () => {
    const mockMember: any[] = [];
    (db.select as any).mockReturnValue(createMockQueryBuilder(mockMember));

    const result = await getEffectivePermissions(TEST_HOUSEHOLD_ID, TEST_USER_ID_NON_MEMBER);
    
    expect(result.role).toBeNull();
    expect(result.rolePermissions).toBeNull();
    expect(result.customPermissions).toBeNull();
    expect(result.effectivePermissions).toBeNull();
  });

  it('should return all permissions for owners (no custom overrides)', async () => {
    const mockRoleMember = [{ role: 'owner' }];
    const mockCustomMember: any[] = [];
    
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await getEffectivePermissions(TEST_HOUSEHOLD_ID, TEST_USER_ID_OWNER);
    
    expect(result.role).toBe('owner');
    expect(result.rolePermissions).toEqual(PERMISSIONS.owner);
    expect(result.effectivePermissions).toEqual(PERMISSIONS.owner);
    
    // Verify all permissions are true (except leave_household)
    for (const [permission, value] of Object.entries(result.effectivePermissions || {})) {
      if (permission === 'leave_household') {
        expect(value).toBe(false); // Owners can't leave
      } else {
        expect(value).toBe(true);
      }
    }
  });
});

describe('Permission Resolution Logic - getUserPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return effective permissions', async () => {
    const mockRoleMember = [{ role: 'admin' }];
    const mockCustomMember: any[] = [];
    
    // Mock for getUserPermissions call
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const result = await getUserPermissions(TEST_HOUSEHOLD_ID, TEST_USER_ID_ADMIN);
    
    // Mock again for getEffectivePermissions call
    (db.select as any)
      .mockReturnValueOnce(createMockQueryBuilder(mockRoleMember))
      .mockReturnValueOnce(createMockQueryBuilder(mockCustomMember));

    const effective = await getEffectivePermissions(TEST_HOUSEHOLD_ID, TEST_USER_ID_ADMIN);
    
    expect(result).toEqual(effective.effectivePermissions);
  });

  it('should return null for non-member', async () => {
    const mockMember: any[] = [];
    (db.select as any).mockReturnValue(createMockQueryBuilder(mockMember));

    const result = await getUserPermissions(TEST_HOUSEHOLD_ID, TEST_USER_ID_NON_MEMBER);
    expect(result).toBeNull();
  });
});

describe('Permission Resolution Logic - isMemberOfHousehold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return true for member', async () => {
    const mockMember = [{ id: 'member-123' }];
    (db.select as any).mockReturnValue(createMockQueryBuilder(mockMember));

    const result = await isMemberOfHousehold(TEST_HOUSEHOLD_ID, TEST_USER_ID_ADMIN);
    expect(result).toBe(true);
  });

  it('should return false for non-member', async () => {
    const mockMember: any[] = [];
    (db.select as any).mockReturnValue(createMockQueryBuilder(mockMember));

    const result = await isMemberOfHousehold(TEST_HOUSEHOLD_ID, TEST_USER_ID_NON_MEMBER);
    expect(result).toBe(false);
  });
});

describe('Permission Resolution Logic - validatePermissionChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should validate owner protection (cannot modify)', async () => {
    const mockMember = [{ role: 'owner' }];
    (db.select as any).mockReturnValue(createMockQueryBuilder(mockMember));

    const customPerms: CustomPermissions = { create_accounts: false };
    const result = await validatePermissionChange(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_OWNER,
      customPerms
    );

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Cannot modify permissions for owners');
  });

  it('should validate last admin protection (cannot remove manage_permissions)', async () => {
    // Single admin household (no owners)
    const mockTargetMember = [{ role: 'admin', userId: TEST_USER_ID_ADMIN }];
    const mockAllAdmins = [{ role: 'admin', userId: TEST_USER_ID_ADMIN, customPermissions: null }];
    const mockOwners: any[] = [];
    
    // First query: get target member (with limit)
    const targetMemberBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockTargetMember),
    };
    
    // Second query: get all admins (without limit)
    const allAdminsBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAllAdmins),
    };
    
    // Third query: get owners (without limit)
    const ownersBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockOwners),
    };
    
    (db.select as any)
      .mockReturnValueOnce(targetMemberBuilder)
      .mockReturnValueOnce(allAdminsBuilder)
      .mockReturnValueOnce(ownersBuilder);

    const customPerms: CustomPermissions = { manage_permissions: false };
    const result = await validatePermissionChange(
      TEST_HOUSEHOLD_ID_SINGLE_ADMIN,
      TEST_USER_ID_ADMIN,
      customPerms
    );

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Cannot remove manage_permissions from the last admin');
  });

  it('should allow removing manage_permissions if other admin exists', async () => {
    // Multiple admins household
    const mockTargetMember = [{ role: 'admin', userId: TEST_USER_ID_ADMIN }];
    const mockAllAdmins = [
      { role: 'admin', userId: TEST_USER_ID_ADMIN, customPermissions: null },
      { role: 'admin', userId: 'other-admin-999', customPermissions: null },
    ];
    const mockOwners: any[] = [];
    
    // First query: get target member (with limit)
    const targetMemberBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockTargetMember),
    };
    
    // Second query: get all admins (without limit)
    const allAdminsBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAllAdmins),
    };
    
    // Third query: get owners (without limit)
    const ownersBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockOwners),
    };
    
    (db.select as any)
      .mockReturnValueOnce(targetMemberBuilder)
      .mockReturnValueOnce(allAdminsBuilder)
      .mockReturnValueOnce(ownersBuilder);

    const customPerms: CustomPermissions = { manage_permissions: false };
    const result = await validatePermissionChange(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      customPerms
    );

    expect(result.isValid).toBe(true);
  });

  it('should allow removing manage_permissions if owner exists', async () => {
    // Household with owner
    const mockTargetMember = [{ role: 'admin', userId: TEST_USER_ID_ADMIN }];
    const mockAllAdmins = [{ role: 'admin', userId: TEST_USER_ID_ADMIN, customPermissions: null }];
    const mockOwners = [{ role: 'owner', userId: TEST_USER_ID_OWNER }];
    
    // First query: get target member (with limit)
    const targetMemberBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockTargetMember),
    };
    
    // Second query: get all admins (without limit)
    const allAdminsBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAllAdmins),
    };
    
    // Third query: get owners (without limit)
    const ownersBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockOwners),
    };
    
    (db.select as any)
      .mockReturnValueOnce(targetMemberBuilder)
      .mockReturnValueOnce(allAdminsBuilder)
      .mockReturnValueOnce(ownersBuilder);

    const customPerms: CustomPermissions = { manage_permissions: false };
    const result = await validatePermissionChange(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      customPerms
    );

    expect(result.isValid).toBe(true); // Owner exists, so it's safe
  });

  it('should validate permission name validity', async () => {
    const mockMember = [{ role: 'admin' }];
    
    // First query: get target member (with limit)
    // Note: Since we're not setting manage_permissions to false, the function won't check for last admin
    const targetMemberBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockMember),
    };
    
    (db.select as any).mockReturnValueOnce(targetMemberBuilder);

    const customPerms: CustomPermissions = { invalid_permission: true } as any;
    const result = await validatePermissionChange(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      customPerms
    );

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid permission: invalid_permission');
  });

  it('should return success for valid changes', async () => {
    const mockMember = [{ role: 'admin' }];
    
    // First query: get target member (with limit)
    // Note: Since we're not setting manage_permissions to false, the function won't check for last admin
    const targetMemberBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockMember),
    };
    
    (db.select as any).mockReturnValueOnce(targetMemberBuilder);

    const customPerms: CustomPermissions = { create_accounts: false };
    const result = await validatePermissionChange(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      customPerms
    );

    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should handle non-existent member', async () => {
    const mockMember: any[] = [];
    
    // First query: get target member (with limit) - returns empty
    const targetMemberBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockMember),
    };
    
    (db.select as any).mockReturnValueOnce(targetMemberBuilder);

    const customPerms: CustomPermissions = { create_accounts: false };
    const result = await validatePermissionChange(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_NON_MEMBER,
      customPerms
    );

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Member not found');
  });

  it('should handle admin with custom manage_permissions override', async () => {
    // Admin with manage_permissions already set to false via custom override
    const mockTargetMember = [{ role: 'admin', userId: TEST_USER_ID_ADMIN }];
    const mockAllAdmins = [
      { 
        role: 'admin', 
        userId: TEST_USER_ID_ADMIN, 
        customPermissions: JSON.stringify({ manage_permissions: false }) 
      },
      { role: 'admin', userId: 'other-admin-999', customPermissions: null },
    ];
    const mockOwners: any[] = [];
    
    // First query: get target member (with limit)
    const targetMemberBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockTargetMember),
    };
    
    // Second query: get all admins (without limit)
    const allAdminsBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockAllAdmins),
    };
    
    // Third query: get owners (without limit)
    const ownersBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockOwners),
    };
    
    (db.select as any)
      .mockReturnValueOnce(targetMemberBuilder)
      .mockReturnValueOnce(allAdminsBuilder)
      .mockReturnValueOnce(ownersBuilder);

    // Attempting to keep it false (should be allowed since other admin exists)
    const customPerms: CustomPermissions = { manage_permissions: false };
    const result = await validatePermissionChange(
      TEST_HOUSEHOLD_ID,
      TEST_USER_ID_ADMIN,
      customPerms
    );

    expect(result.isValid).toBe(true);
  });
});

