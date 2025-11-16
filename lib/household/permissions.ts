import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export type HouseholdRole = 'owner' | 'admin' | 'member' | 'viewer';

export type HouseholdPermission =
  | 'invite_members'
  | 'remove_members'
  | 'manage_permissions'
  | 'create_accounts'
  | 'edit_accounts'
  | 'delete_accounts'
  | 'create_transactions'
  | 'edit_all_transactions'
  | 'view_all_data'
  | 'manage_budget'
  | 'delete_household'
  | 'leave_household';

/**
 * Custom permission overrides stored as JSON object.
 * Format: { "permission_name": true/false }
 * Only permissions that differ from role defaults are stored.
 */
export type CustomPermissions = Partial<Record<HouseholdPermission, boolean>>;

export const PERMISSIONS: Record<HouseholdRole, Record<HouseholdPermission, boolean>> = {
  owner: {
    invite_members: true,
    remove_members: true,
    manage_permissions: true,
    create_accounts: true,
    edit_accounts: true,
    delete_accounts: true,
    create_transactions: true,
    edit_all_transactions: true,
    view_all_data: true,
    manage_budget: true,
    delete_household: true,
    leave_household: false, // Owners can't leave
  },
  admin: {
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
  member: {
    invite_members: false,
    remove_members: false,
    manage_permissions: false,
    create_accounts: false,
    edit_accounts: false,
    delete_accounts: false,
    create_transactions: true,
    edit_all_transactions: true,
    view_all_data: true,
    manage_budget: false,
    delete_household: false,
    leave_household: true,
  },
  viewer: {
    invite_members: false,
    remove_members: false,
    manage_permissions: false,
    create_accounts: false,
    edit_accounts: false,
    delete_accounts: false,
    create_transactions: false,
    edit_all_transactions: false,
    view_all_data: true,
    manage_budget: false,
    delete_household: false,
    leave_household: true,
  },
};

/**
 * Get a user's role in a household.
 * 
 * @param householdId - The ID of the household
 * @param userId - The ID of the user
 * @returns The user's role ('owner', 'admin', 'member', or 'viewer'), or null if not a member
 * 
 * @example
 * ```typescript
 * const role = await getUserHouseholdRole('household-123', 'user-456');
 * if (role === 'owner') {
 *   // User is the owner
 * }
 * ```
 */
export async function getUserHouseholdRole(
  householdId: string,
  userId: string
): Promise<HouseholdRole | null> {
  const member = await db
    .select({ role: householdMembers.role })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId)
      )
    )
    .limit(1);

  return member.length > 0 ? (member[0].role as HouseholdRole) : null;
}

/**
 * Get custom permission overrides for a user in a household.
 * 
 * This is an internal helper function that retrieves and parses custom permission
 * overrides from the database. Returns null if no custom permissions are set or
 * if the JSON is invalid.
 * 
 * @param householdId - The ID of the household
 * @param userId - The ID of the user
 * @returns Custom permission overrides object, or null if none exist or JSON is invalid
 * 
 * @remarks
 * - Invalid JSON in the database is handled gracefully (returns null)
 * - Only permissions that differ from role defaults are stored
 */
async function getCustomPermissions(
  householdId: string,
  userId: string
): Promise<CustomPermissions | null> {
  const member = await db
    .select({ customPermissions: householdMembers.customPermissions })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId)
      )
    )
    .limit(1);

  if (member.length === 0 || !member[0].customPermissions) {
    return null;
  }

  try {
    return JSON.parse(member[0].customPermissions) as CustomPermissions;
  } catch {
    // Invalid JSON, return null
    return null;
  }
}

/**
 * Check if a user has a specific permission in a household.
 * 
 * Permission resolution follows this order:
 * 1. Check custom permissions (if set, deny takes precedence over allow)
 * 2. Fall back to role-based permissions
 * 
 * **Important Security Rules:**
 * - Owners always have all permissions and cannot have custom permissions
 * - Deny takes precedence: if a custom permission is set to `false`, it denies
 *   access even if the role allows it
 * - Returns `false` if user is not a member of the household
 * 
 * @param householdId - The ID of the household
 * @param userId - The ID of the user
 * @param permission - The permission to check
 * @returns `true` if user has the permission, `false` otherwise
 * 
 * @example
 * ```typescript
 * const canCreate = await hasPermission('household-123', 'user-456', 'create_accounts');
 * if (canCreate) {
 *   // User can create accounts
 * }
 * ```
 * 
 * @remarks
 * This function is used throughout the application to enforce permission checks.
 * Always use this function instead of checking roles directly.
 */
export async function hasPermission(
  householdId: string,
  userId: string,
  permission: HouseholdPermission
): Promise<boolean> {
  const role = await getUserHouseholdRole(householdId, userId);
  if (!role) return false;

  // Owners always have all permissions
  if (role === 'owner') {
    return PERMISSIONS.owner[permission];
  }

  // Check custom permissions first (deny takes precedence)
  const customPermissions = await getCustomPermissions(householdId, userId);
  if (customPermissions && permission in customPermissions) {
    // Custom permission exists, use it (deny takes precedence)
    return customPermissions[permission] === true;
  }

  // Fall back to role-based permissions
  return PERMISSIONS[role][permission];
}

/**
 * Get effective permissions for a user in a household.
 * 
 * Combines role-based permissions with custom overrides to calculate the final
 * effective permissions. This is useful for displaying permissions in the UI
 * or for debugging permission issues.
 * 
 * **Permission Resolution:**
 * - Starts with role-based permissions as the base
 * - Applies custom overrides (deny takes precedence)
 * - Returns null values if user is not a member
 * 
 * @param householdId - The ID of the household
 * @param userId - The ID of the user
 * @returns Object containing:
 *   - `role`: The user's role, or null if not a member
 *   - `rolePermissions`: All permissions from the role defaults
 *   - `customPermissions`: Custom permission overrides, or null if none
 *   - `effectivePermissions`: Final calculated permissions (role + custom overrides)
 * 
 * @example
 * ```typescript
 * const perms = await getEffectivePermissions('household-123', 'user-456');
 * console.log(perms.effectivePermissions.create_accounts); // true or false
 * ```
 * 
 * @remarks
 * This function is used by the API endpoints to return complete permission
 * information to the frontend.
 */
export async function getEffectivePermissions(
  householdId: string,
  userId: string
): Promise<{
  role: HouseholdRole | null;
  rolePermissions: Record<HouseholdPermission, boolean> | null;
  customPermissions: CustomPermissions | null;
  effectivePermissions: Record<HouseholdPermission, boolean> | null;
}> {
  const role = await getUserHouseholdRole(householdId, userId);
  if (!role) {
    return {
      role: null,
      rolePermissions: null,
      customPermissions: null,
      effectivePermissions: null,
    };
  }

  const rolePermissions = PERMISSIONS[role];
  const customPermissions = await getCustomPermissions(householdId, userId);

  // Calculate effective permissions
  const effectivePermissions: Record<HouseholdPermission, boolean> = {
    ...rolePermissions,
  };

  // Apply custom overrides (deny takes precedence)
  if (customPermissions) {
    for (const [permission, value] of Object.entries(customPermissions)) {
      if (permission in effectivePermissions) {
        effectivePermissions[permission as HouseholdPermission] = value === true;
      }
    }
  }

  return {
    role,
    rolePermissions,
    customPermissions,
    effectivePermissions,
  };
}

/**
 * Get all permissions a user has in a household.
 * 
 * Returns the effective permissions (role-based + custom overrides) as a simple
 * object mapping permission names to boolean values.
 * 
 * @param householdId - The ID of the household
 * @param userId - The ID of the user
 * @returns Object mapping permission names to boolean values, or null if not a member
 * 
 * @example
 * ```typescript
 * const perms = await getUserPermissions('household-123', 'user-456');
 * if (perms?.create_accounts) {
 *   // User can create accounts
 * }
 * ```
 * 
 * @remarks
 * This is a convenience function that wraps `getEffectivePermissions()` and
 * returns only the effective permissions object.
 */
export async function getUserPermissions(
  householdId: string,
  userId: string
): Promise<Record<HouseholdPermission, boolean> | null> {
  const { effectivePermissions } = await getEffectivePermissions(householdId, userId);
  return effectivePermissions;
}

/**
 * Check if a user is a member of a household.
 * 
 * @param householdId - The ID of the household
 * @param userId - The ID of the user
 * @returns `true` if user is a member, `false` otherwise
 * 
 * @example
 * ```typescript
 * const isMember = await isMemberOfHousehold('household-123', 'user-456');
 * if (!isMember) {
 *   return Response.json({ error: 'Not a member' }, { status: 403 });
 * }
 * ```
 * 
 * @remarks
 * This function is used for basic membership checks before performing
 * household-scoped operations.
 */
export async function isMemberOfHousehold(
  householdId: string,
  userId: string
): Promise<boolean> {
  const member = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId)
      )
    )
    .limit(1);

  return member.length > 0;
}

/**
 * Validate permission changes before applying them.
 * 
 * Performs security checks to ensure permission changes are safe:
 * - **Owner Protection:** Cannot modify permissions for owners
 * - **Last Admin Protection:** Cannot remove `manage_permissions` from the last admin
 * - **Permission Name Validation:** Only valid permission names are allowed
 * 
 * @param householdId - The ID of the household
 * @param targetUserId - The ID of the user whose permissions are being changed
 * @param newCustomPermissions - The new custom permissions to validate
 * @returns Object with:
 *   - `isValid`: `true` if changes are valid, `false` otherwise
 *   - `error`: Error message if validation fails (optional)
 * 
 * @example
 * ```typescript
 * const validation = await validatePermissionChange(
 *   'household-123',
 *   'user-456',
 *   { create_accounts: false }
 * );
 * if (!validation.isValid) {
 *   return Response.json({ error: validation.error }, { status: 400 });
 * }
 * ```
 * 
 * @remarks
 * **Security Considerations:**
 * - Always call this function before updating permissions in the database
 * - Owner protection prevents accidental lockout
 * - Last admin protection ensures at least one admin can manage permissions
 * - Invalid permission names are rejected to prevent security issues
 * 
 * **Last Admin Protection Logic:**
 * - Checks if removing `manage_permissions` from an admin
 * - Verifies at least one other admin or owner has `manage_permissions`
 * - Considers custom permission overrides when checking other admins
 */
export async function validatePermissionChange(
  householdId: string,
  targetUserId: string,
  newCustomPermissions: CustomPermissions
): Promise<{ isValid: boolean; error?: string }> {
  // Get target member
  const member = await db
    .select({ role: householdMembers.role })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, targetUserId)
      )
    )
    .limit(1);

  if (member.length === 0) {
    return { isValid: false, error: 'Member not found' };
  }

  const targetRole = member[0].role as HouseholdRole;

  // Owners cannot have permissions modified
  if (targetRole === 'owner') {
    return { isValid: false, error: 'Cannot modify permissions for owners' };
  }

  // Check if removing manage_permissions from last admin
  if (
    newCustomPermissions.manage_permissions === false &&
    targetRole === 'admin'
  ) {
    // Get all admins (including target user)
    const allAdmins = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.role, 'admin')
        )
      );

    // Check if any other admin has manage_permissions (not overridden to false)
    let hasOtherAdminWithManagePermissions = false;
    for (const admin of allAdmins) {
      // Skip the target user (we're checking if removing their permission is safe)
      if (admin.userId === targetUserId) {
        continue;
      }

      const adminCustomPermissions = admin.customPermissions
        ? (JSON.parse(admin.customPermissions) as CustomPermissions)
        : null;
      
      // Admin has manage_permissions if:
      // 1. No custom override (uses role default = true)
      // 2. Custom override is explicitly true
      const adminHasManagePermissions =
        adminCustomPermissions?.manage_permissions !== false;
      
      if (adminHasManagePermissions) {
        hasOtherAdminWithManagePermissions = true;
        break;
      }
    }

    // Also check owners (they always have manage_permissions)
    const owners = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.role, 'owner')
        )
      );

    if (owners.length === 0 && !hasOtherAdminWithManagePermissions) {
      return {
        isValid: false,
        error: 'Cannot remove manage_permissions from the last admin',
      };
    }
  }

  // Validate permission names
  const validPermissions: HouseholdPermission[] = [
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
    'leave_household',
  ];

  for (const permission of Object.keys(newCustomPermissions)) {
    if (!validPermissions.includes(permission as HouseholdPermission)) {
      return {
        isValid: false,
        error: `Invalid permission: ${permission}`,
      };
    }
  }

  return { isValid: true };
}
