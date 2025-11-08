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
 * Get a user's role in a household
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
 * Check if a user has a specific permission in a household
 */
export async function hasPermission(
  householdId: string,
  userId: string,
  permission: HouseholdPermission
): Promise<boolean> {
  const role = await getUserHouseholdRole(householdId, userId);
  if (!role) return false;
  return PERMISSIONS[role][permission];
}

/**
 * Get all permissions a user has in a household
 */
export async function getUserPermissions(
  householdId: string,
  userId: string
): Promise<Record<HouseholdPermission, boolean> | null> {
  const role = await getUserHouseholdRole(householdId, userId);
  if (!role) return null;
  return PERMISSIONS[role];
}

/**
 * Check if a user is a member of a household
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
